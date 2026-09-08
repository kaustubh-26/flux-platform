# Architecture Decision Records (ADR)

This document captures the **key architectural decisions** made while building **Flux** — an event-driven, real-time data platform.

Each decision records:

* The **context** in which the decision was made
* The **decision** itself
* The **trade-offs** involved

These ADRs exist to explain *why* the system looks the way it does, not just *what* it looks like.

---

## ADR-001: Kafka as the Primary Integration Backbone

### Context

The system needs to support multiple independent domain services (weather, crypto, stocks, news) while enabling real-time fan-out to clients.

Direct service-to-service calls would introduce tight coupling, cascading failures, and scaling complexity.

### Decision

Use **Kafka** as the sole integration layer between the BFF and all domain services.

All inter-service communication happens via:

* **Command topics** (intent)
* **Event topics** (facts)

### Consequences

**Pros:**

* Loose coupling between services
* Replayable event history
* Independent scaling and deployment
* Clear ownership boundaries

**Cons:**

* Higher operational complexity
* Requires careful topic design and idempotency

---

## ADR-002: Backend-for-Frontend (BFF) Pattern

### Context

The frontend requires real-time data from multiple domains, but exposing Kafka or service internals to the client would greatly increase complexity and risk.

### Decision

Introduce a **Backend-for-Frontend (BFF)** as the single real-time gateway.

The BFF:

* Consumes Kafka events
* Produces Kafka commands
* Manages Socket.IO connections
* Handles caching, deduplication, and fan-out

### Consequences

**Pros:**

* Simplified frontend
* Centralized real-time logic
* Protocol translation (Kafka ⇄ WebSockets)

**Cons:**

* BFF becomes a critical system component
* Requires careful resilience design

---

## ADR-003: Command → Event Messaging Model

### Context

Mixing requests and state changes on the same Kafka topics leads to ambiguity and tight coupling.

### Decision

Adopt a strict **Command → Event** model:

* Commands express *intent*
* Events express *facts*

Services consume commands and publish events. They never respond directly.

### Consequences

**Pros:**

* Clear mental model
* Easier debugging and observability
* Safe replay semantics

**Cons:**

* Slightly higher latency vs direct RPC

---

## ADR-004: Snapshot-Based Data Model (Not Deltas)

### Context

Real-time clients frequently connect, disconnect, and reconnect. Delta-based updates complicate hydration and error handling.

### Decision

All services publish **full snapshots**, not incremental deltas.

The BFF caches the latest snapshot per domain and uses it for:

* Immediate client hydration
* Reconnect recovery

### Consequences

**Pros:**

* Simple client logic
* Safe reconnections
* No dependency on event ordering

**Cons:**

* Higher payload sizes
* Some redundant data transmission

---

## ADR-005: Cache as an Optional Accelerator (Valkey)

### Context

Using cache as a dependency can turn it into a single point of failure.

### Decision

Use **Valkey (Redis-compatible)** strictly as a **non-critical accelerator**.

Cache failures:

* Are logged
* Never block execution
* Never affect correctness

### Consequences

**Pros:**

* Graceful degradation
* Predictable failure behavior

**Cons:**

* Reduced performance during cache outages

---

## ADR-006: Request-Driven Services (Where Applicable)

### Context

Not all domains require continuous polling or streaming (e.g. weather, news, stocks).

### Decision

Design services to be **request-driven** unless continuous streaming is required.

Examples:

* Weather updates only on location changes
* News refresh on command or scheduler
* Stocks refreshed periodically or on demand

### Consequences

**Pros:**

* Reduced upstream API usage
* Lower operational cost

**Cons:**

* Slightly stale data between refreshes

---

## ADR-007: Crypto Tickers as Streaming Data with Hydration Caching

### Context

Crypto ticker data is extremely high-frequency. While it cannot rely on cache as the primary delivery mechanism, clients connecting or refreshing without a cached snapshot experience cold-start latency until the next trade event arrives.

### Decision

Stream crypto tickers live, but maintain a short-lived last-known snapshot in the cache:

* Streamed from Coinbase via `crypto-service` and published to Kafka
* **Crypto Tickers**: Cached as a short-lived snapshot (`crypto:tickers`, TTL 300s) exclusively for immediate client hydration upon connection/refresh, then streamed live
* Relayed live to connected WebSocket clients

### Consequences

**Pros:**

* Instant client hydration without blank UI states
* Always-fresh pricing via live streaming
* Minimal cache memory footprint (short TTL, bounded key space)

**Cons:**

* Minor cache overhead to maintain the latest snapshot map

---

## ADR-008: Socket.IO Rooms for Selective Fan-Out

### Context

Broadcasting all updates to all clients wastes bandwidth and increases client-side filtering.

### Decision

Use **Socket.IO rooms** to scope delivery:

* `weather.{city}`
* `crypto.global`
* `news.global`
* `stock.global`

### Consequences

**Pros:**

* Efficient fan-out
* Reduced client-side complexity

**Cons:**

* Requires careful room lifecycle management

---

## ADR-009: Avoid Exactly-Once Semantics

### Context

Exactly-once delivery across distributed systems is complex and costly.

### Decision

Accept **at-least-once delivery** and design consumers to be idempotent where needed.

### Consequences

**Pros:**

* Simpler system
* Better reliability under failure

**Cons:**

* Potential duplicate processing (handled by design)

---

## ADR-010: OSS-First Documentation Philosophy

### Context

Flux is intended to be a **portfolio-grade open-source project**.

### Decision

Invest heavily in documentation:

* README per service
* Architecture docs
* Explicit contracts
* ADRs for decisions

### Consequences

**Pros:**

* Easy onboarding
* Clear intent
* Contributor-friendly

**Cons:**

* Higher documentation maintenance cost

---

## ADR-011: Unified Ingress Gateway (Nginx Reverse Proxy)

### Context

Exposing multiple ports to client browsers (`5173` for UI, `3000` for Socket.IO, `4001` for Auth) complicates CORS policies, secure session cookie scoping, and container networking.

### Decision

Deploy **Nginx** as a unified reverse proxy on port `80`:

* `/` → Static React UI
* `/socket.io/` → BFF real-time WebSocket connection
* `/auth/` → Dedicated Auth Service (OAuth2 SSO & JWT)

### Consequences

**Pros:**

* True same-origin architecture with zero CORS overhead
* Unified `HttpOnly` cookie domain for secure sessions
* Single, predictable port for local and production deployment (`http://localhost`)

**Cons:**

* Additional proxy hop in the network path

---

## ADR-012: Resource-Constrained Platform Profile (Raspberry Pi 2 / 1GB RAM)

### Context

Running a complete event-driven ecosystem (Kafka, Valkey, BFF, Auth, 4 domain microservices, logging) on a Raspberry Pi 2 v1.2 (32-bit ARMv7, 1GB total RAM) risks fatal OOM kills without aggressive resource management.

### Decision

Implement system-wide resource boundaries:

* Custom single-node Kafka KRaft image (`kafka/Dockerfile`) on `eclipse-temurin:17-jre-jammy` for `linux/arm/v7`, eliminating Zookeeper memory overhead
* Strict Docker Compose container memory caps (`mem_limit`) and log rotation
* Tuned Node.js V8 heap caps (`--max-old-space-size=48` and `96`)
* Lightweight log shipping via Promtail (48MB limit) to Grafana Cloud rather than running a heavy local Loki TSDB and Grafana instance
* Dashboards-as-Code operational dashboard provisioned in `grafana/dashboards/flux-logs.json` for turnkey Grafana Cloud telemetry
* Multi-stage Docker builds copying host-precompiled TypeScript (`dist/`) to prevent build-time memory exhaustion

### Consequences

**Pros:**

* Complete 9-container event-driven platform runs stably within a 1GB memory budget
* Eliminates unexpected kernel OOM process termination
* Preserves flash storage longevity via capped log rotations

**Cons:**

* Requires external Grafana Cloud credentials for log visualization

---

## Final Note

These decisions are **intentional and explicit**.

Future contributors are encouraged to:

* Add new ADRs for major changes
* Revisit decisions if constraints change
* Preserve architectural clarity over short-term convenience

This document is the architectural memory of **Flux**.
