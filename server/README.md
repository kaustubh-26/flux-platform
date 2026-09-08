# Server (Flux BFF)

This directory contains the **Backend-for-Frontend (BFF)** for the **Flux platform**.

The Flux BFF is responsible for **bridging Kafka-based domain services with real-time WebSocket clients**, while providing caching, resilience, and protocol abstraction behind a single, stable interface.

This is the most critical component in the system.

---

## 🎯 Purpose of the BFF

The BFF exists to:

* Shield the frontend from Kafka and service internals
* Centralize real-time fan-out logic
* Provide cache-backed hydration for fast UI loads
* Enforce resilience and graceful degradation
* Act as the single real-time gateway for clients

The frontend **never communicates directly** with Kafka or domain services.

---

## 🧠 Responsibilities

The BFF handles:

* Socket.IO server lifecycle
* Kafka producer (command dispatch)
* Kafka consumers (event ingestion)
* Room-based message fan-out
* Valkey / Redis cache integration
* Deduplication of noisy client events
* Startup refresh orchestration
* Graceful shutdown & recovery

It is **state-aware but not state-owning**.

---

## 📦 Directory Structure

```
server/
│
├── src/
│   ├── modules/            # Kafka consumers → Socket emitters
│   │   ├── weatherConsumer.ts
│   │   ├── cryptoTopMoversConsumer.ts
│   │   ├── cryptoTopCoinsConsumer.ts
│   │   ├── cryptoTickerConsumer.ts
│   │   ├── newsConsumer.ts
│   │   └── stockTopPerformersConsumer.ts
│   │
│   ├── cache/              # Valkey integration & helpers
│   │   └── index.ts
│   │
│   ├── constants/          # Cache keys, room names, topic constants
│   │   ├── crypto.ts
│   │   ├── news.ts
│   │   └── stocks.ts
│   │
│   ├── interfaces/         # Shared domain interfaces
│   │   └── location.ts
│   │
│   ├── sendLocation.ts     # Deduplication & Kafka command logic
│   │
│   ├── logger/             # Structured logging (pino)
│   │   └── index.ts
│   │
│   └── server.ts           # Bootstrap, sockets, Kafka, lifecycle
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 🔄 Kafka Integration

### Producer

The BFF produces **command messages** to domain services, including:

* Weather fetch commands (user-driven)
* Crypto snapshot refresh triggers
* Stock and news refresh requests

The producer is:

* Idempotent
* Reconnected with exponential backoff
* Considered **critical** (the BFF fails fast if Kafka is unavailable at startup)

---

### Consumers

Each domain has a **dedicated Kafka consumer**:

* Weather updates
* Crypto movers
* Crypto top coins
* Crypto ticker (high frequency, streaming)
* News updates
* Stock top performers

Consumers:

* Validate payloads defensively
* Cache snapshots **only where appropriate**
* Emit Socket.IO events to scoped rooms

⚠️ **Important note:**

* **Crypto Tickers**: Cached as a short-lived snapshot (`crypto:tickers`, TTL 300s) exclusively for immediate client hydration upon connection/refresh, then streamed live.
* They are streamed live from `crypto-service`, which consumes Coinbase WebSocket feeds.

---

## ⚡ Caching Behavior

The BFF integrates with **Valkey (Redis-compatible)** as an **optional accelerator**, not a dependency.

Used for:

* Fast client hydration on reconnect (including latest crypto tickers)
* Short-lived realtime snapshots (news, stocks, crypto movers, crypto top coins, crypto tickers)
* Deduplication windows for user events

Not used for:

* Long-term history or time-series storage
* Source-of-truth storage

If cache becomes unavailable:

* Errors are logged
* Cache reads return `null`
* Writes are ignored
* The system continues in degraded mode

See `docs/caching-strategy.md` for details.

---

## 🏠 Socket.IO Strategy

### Same-Origin & Proxy-Aware

The BFF is designed to run behind an Nginx reverse proxy.

* Socket.IO is exposed at `/socket.io`
* Frontend connects via same origin
* No CORS or hard-coded URLs required

---

### Rooms

The BFF uses rooms for selective fan-out:

* `weather.{city}` – city-scoped weather updates
* `crypto.global` – all crypto data
* `news.global` – global news
* `stock.global` – stock performers

Clients automatically join relevant rooms based on declared intent.

---

## 🔁 Deduplication Logic

To avoid flooding Kafka and downstream services:

* User location updates are hashed
* Last-seen payloads are cached briefly
* Duplicate events within a short window are ignored

This keeps the system efficient under noisy clients without sacrificing correctness.

---

## 🚦 Startup & Recovery

### Startup

On startup, the BFF:

1. Connects Kafka producer
2. Starts all domain consumers
3. Sends initial refresh commands
4. Warms cache with fresh snapshots (where applicable)

---

### Recovery

If Kafka becomes unavailable:

* BFF enters degraded mode
* Reconnection loop retries automatically
* Consumers are restarted safely

---

### Shutdown

The BFF handles graceful shutdown:

* Stops accepting new socket connections
* Closes Socket.IO server
* Disconnects Kafka consumers and producer
* Closes cache connection

This prevents zombie consumers and message loss.

---

## 🧪 Testing Notes

Testing focuses on:

* Unit tests for pure logic
* Minimal integration tests for Kafka boundaries
* Cache mocked or treated as optional

The BFF is designed to be **testable without Kafka** in most cases.

---

## 🚀 Running the BFF

The BFF is typically run via **docker-compose** as part of the full Flux system.

For local development:

```bash
npm install
npm run build
npm run start
```

Environment variables are validated at startup.

---

## ✅ Summary

The Flux BFF is:

* The real-time backbone of the platform
* The integration point between services and clients
* Proxy-aware, cache-tolerant, and resilient by design

Understanding this folder means understanding the entire system.
