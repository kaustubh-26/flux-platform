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

## ADR-007: Crypto Tickers as Stream-Only Data

### Context

Crypto ticker data is extremely high-frequency and unsuitable for cache-based delivery.

### Decision

Treat crypto tickers as **stream-only**:

* Streamed from Coinbase
* Batched and published to Kafka
* Not cached at the BFF

### Consequences

**Pros:**

* Lower cache pressure
* Always-fresh pricing

**Cons:**

* No historical replay for tickers

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

## Final Note

These decisions are **intentional and explicit**.

Future contributors are encouraged to:

* Add new ADRs for major changes
* Revisit decisions if constraints change
* Preserve architectural clarity over short-term convenience

This document is the architectural memory of **Flux**.
