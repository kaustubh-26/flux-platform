# Flux – Architecture

This document explains the **architectural decisions, data flow, and trade-offs** behind **Flux**, an event-driven real-time data platform.

The goal of this architecture is to support **low-latency real-time updates**, **independent domain scaling**, and **graceful degradation** under partial failures — while keeping the frontend simple.

---

## 🎯 Design Goals

1. **Real-time first** – push data, don’t poll
2. **Loose coupling** between frontend and backend systems
3. **Domain isolation** – each service owns its data and logic
4. **Resilience by default** – tolerate Kafka/cache failures
5. **Fast client hydration** on reconnects
6. **Portfolio realism** – mirrors production systems

---

## 🧩 Architectural Overview

The diagram below illustrates the high-level architecture and data flow across Flux components.

The system is organized into four distinct layers:

```
Client (Browser / Mobile)
        │
        ▼ (Port 80)
Nginx Ingress Reverse Proxy
        │
        ├─► /           → Frontend (React UI)
        ├─► /socket.io/ → BFF (Real-time gateway)
        └─► /auth/      → Auth Service (OAuth2 SSO & JWT)
                             │
                             ▼
                          MongoDB
BFF (Socket.IO + Kafka + Cache)
        │
        ▼
Domain Services (Kafka-based Microservices)
```

Each layer has a **single, clear responsibility**.

All inter-service streaming and coordination is asynchronous and Kafka-backed, enabling loose coupling and independent scaling.

---

## 🧾 Architectural Decision Records (ADR)

Key architectural choices in Flux are documented as **Architecture Decision Records (ADRs)**.

Each ADR explains:
- The **context** in which a decision was made
- The **decision** itself
- The **trade-offs** and consequences

| Area | Decision |
|----|----|
| System boundary | [ADR-001: Backend-for-Frontend (BFF)](ARCHITECTURE_DECISIONS.md#adr-001-backend-for-frontend-bff) |
| Messaging | [ADR-002: Kafka as Command/Event Backbone](ARCHITECTURE_DECISIONS.md#adr-002-kafka-command--event-model) |
| Realtime delivery | [ADR-003: Socket.IO over raw WebSockets](ARCHITECTURE_DECISIONS.md#adr-003-socketio-for-realtime-delivery) |
| Caching | [ADR-004: Valkey as Optional Accelerator](ARCHITECTURE_DECISIONS.md#adr-004-valkey-optional-cache) |
| Streaming strategy | [ADR-005: Snapshot vs Stream Separation](ARCHITECTURE_DECISIONS.md#adr-005-stream-vs-snapshot-data) |
| Ingress gateway | [ADR-011: Unified Ingress Gateway (Nginx)](ARCHITECTURE_DECISIONS.md#adr-011-unified-ingress-gateway-nginx-reverse-proxy) |
| Resource footprint | [ADR-012: Resource-Constrained Platform Profile](ARCHITECTURE_DECISIONS.md#adr-012-resource-constrained-platform-profile-raspberry-pi-2--1gb-ram) |

The **Architecture document describes _what exists_**.  
ADRs explain **_why these choices were made_**.

---

## 🚪 Ingress Gateway & Auth Layer (Nginx + Auth Service)

To provide a unified same-origin entry point and decouple web clients from backend topology, **Nginx** serves as the system's ingress gateway on port `80`.

### Nginx Routing

* `/` → Proxies to the static React frontend container
* `/socket.io/` → Upgrades and proxies persistent WebSocket connections to the **BFF** (`server:3000`)
* `/auth/` → Routes OAuth2 SSO routes (`/auth/google`, `/auth/github`), callbacks, `/me`, and logout to the **Auth Service** (`auth:4001`)

### Auth Service & User Identity

The **Auth Service** operates as a standalone microservice responsible for:

* **OAuth2 SSO**: Handles Google and GitHub OAuth handshakes.
* **User Persistence**: Stores user profiles in **MongoDB** via Mongoose models.
* **JWT Cookie Sessions**: Signs JSON Web Tokens and sets them inside secure, `HttpOnly` cookies (`flux_auth_token`), keeping credentials inaccessible to client-side JavaScript.
* **BFF Identity Handshake**: Real-time clients connect anonymously or pass their session, while guest users are tracked deterministically via `flux_guest_id` and acknowledged via `session:init`.

---


## 🖥 Frontend Layer

**Responsibilities:**

* Display real-time data
* Send user intent (location updates, data requests)
* Maintain Socket.IO connection

**Not responsible for:**

* Kafka
* Service discovery
* Data aggregation
* Retry or backoff logic

> The frontend talks **only** to the BFF.

This dramatically simplifies the client and avoids leaking infrastructure complexity into UI code.

---

## 🧠 BFF (Backend-for-Frontend)

The BFF is the **heart of the system**, acting as the real-time gateway between Kafka-based services and clients.

> Architectural rationale:  
> See [ADR-001: Backend-for-Frontend](ARCHITECTURE_DECISIONS.md#adr-001-backend-for-frontend-bff)

### Why a BFF?

Without a BFF:

* Frontend would need to know Kafka topics
* Multiple WebSocket connections per domain
* Duplicated caching and retry logic

With a BFF:

* Single Socket.IO connection per client
* Centralized fan-out logic
* One place for resilience patterns

---

### BFF Responsibilities

* Kafka **producer** (commands)
* Kafka **consumers** (events)
* WebSocket room management
* Cache-backed hydration
* Event deduplication
* Startup refresh orchestration
* Graceful shutdown handling

The BFF is **state-aware but not state-owning**.

---

## 🔄 Event vs Command Topics

The system follows a **Command → Event** model.

### Commands

* Intent-based
* Request an action
* Example:

  * `weather.service.command.fetch`
  * `crypto.service.command.topcoins.refresh`

### Events

* Fact-based
* Represent something that already happened
* Example:

  * `weather.service.event.updated`
  * `crypto.ticker.event.updated`

This separation:

* Improves observability
* Prevents tight coupling
* Makes replay and debugging easier

Kafka provides decoupled, **at-least-once delivery semantics** across all commands and events.

---

## 🛰 Domain Services

Each service:

* Owns **one domain**
* Acts as a Kafka **consumer** (commands)
* Acts as a Kafka **producer** (events)
* Is stateless or locally stateful

Services **never talk to each other directly**.

Kafka is the only integration point.

---

### Example: Weather Service

Flow:

1. BFF sends `weather.service.command.fetch`
2. Weather service fetches external API
3. Publishes `weather.service.event.updated`
4. BFF consumes and emits to clients

This allows:

* Multiple consumers
* Easy replay
* Independent scaling

---

## ⚡ Cache Layer (Valkey / Redis)

The cache is used as a **performance accelerator**, never as a source of truth.

> Architectural rationale:  
> See [ADR-004: Valkey as Optional Accelerator](ARCHITECTURE_DECISIONS.md#adr-004-valkey-optional-cache)

### Used for:

* Reconnect hydration
* Short-lived snapshots
* Deduplication windows

### Not used for:

* Source of truth
* Business correctness

If cache goes down:

* BFF logs warning
* System continues with higher latency

This is intentional.

---

### Shared Cache Access

The cache is shared across:

* BFF
* Weather service
* Crypto service
* Stock service
* News service

Services use the cache opportunistically for short-lived data and deduplication, never as a source of truth.

---

## 🔁 Deduplication Strategy

User location updates are deduplicated to avoid:

* Kafka overload
* Downstream service spam

Mechanism:

* Hash last payload
* Store timestamp in cache
* Ignore duplicates within a short window

This keeps the system responsive without losing correctness.

---

## 🔌 Socket.IO Room Strategy

Rooms are used for **selective fan-out**:

* `weather.{city}` – city-specific updates
* `crypto.global` – global crypto data
* `news.global` – global news
* `stock.global` – stock performers

This avoids broadcasting unnecessary data to all clients.

---

## 🔄 Startup & Recovery Behavior

### Startup

* BFF connects Kafka producer
* Starts Kafka consumers
* Sends initial refresh commands
* Warms cache

### Runtime Recovery

* Kafka reconnect loop
* Exponential backoff
* Consumers restarted safely

### Shutdown

* Stop accepting new sockets
* Disconnect Kafka consumers
* Close cache connections

This prevents message loss and zombie consumers.

---

## 🧪 Testing Implications

This architecture enables:

* Pure unit tests for logic
* Minimal integration tests for boundaries
* No Kafka dependency in most tests

Details in `docs/testing.md`.

---

## 🧠 Trade-offs & Non-goals

### Trade-offs

* Slightly more infrastructure
* BFF is a critical component

### Non-goals

* Exactly-once end-to-end semantics
* Ultra-low latency (<10ms)
* Frontend Kafka access

These are conscious decisions.

---

## 🍓 Resource-Constrained Deployment (Raspberry Pi 2 / 1GB RAM)

Flux is designed, tested, and optimized to run reliably on resource-constrained hardware such as a **Raspberry Pi 2 v1.2** (32-bit ARMv7, 1GB total RAM).

Key architectural decisions for low-footprint environments:

1. **Custom ARMv7 Kafka KRaft (`kafka/Dockerfile`)**:
   - Runs Kafka in single-node KRaft mode (no Zookeeper JVM), built on `eclipse-temurin:17-jre-jammy` with ARMv7 compatibility.
   - JVM heap is tightly capped (`KAFKA_HEAP_OPTS: "-Xms160m -Xmx160m"`).
2. **Strict Container Memory Budgets (`mem_limit`)**:
   - Hard memory limits prevent Linux OOM kills: `kafka` (256MB), `server` (128MB), `valkey` (64MB with 48MB LRU eviction), microservices (64MB each), `promtail` (48MB), `nginx` (16MB).
3. **V8 Heap Constraints**:
   - Node.js processes enforce `--max-old-space-size=48` (services) and `--max-old-space-size=96` (BFF) to trigger garbage collection before reaching cgroup limits.
4. **Log Rotation**:
   - Docker `json-file` driver limits logs to `max-size: 2m` with `max-file: 2`, protecting flash storage from disk exhaustion.
5. **Cloud-Offloaded Observability (Promtail → Grafana Cloud)**:
   - Rather than running heavy local Loki TSDB and Grafana instances (>350MB RAM), a lightweight **Promtail** shipper (48MB limit) ships Docker logs to **Grafana Cloud Loki**, keeping host resources available for streaming workloads.
   - Centralized observability is provisioned via Dashboards-as-Code in [`grafana/dashboards/flux-logs.json`](../grafana/dashboards/flux-logs.json).
6. **Host-Side Pre-Builds**:
   - Multi-stage Docker builds copy pre-compiled TypeScript artifacts (`dist/`) directly, avoiding build-time compiler memory exhaustion on 1GB hosts.

---

## ✅ Summary

This architecture prioritizes:

* Clarity over cleverness
* Resilience over perfection
* Separation over shortcuts

It is designed to scale **conceptually and operationally**, and to clearly demonstrate real-world system design skills.
