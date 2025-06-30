# Crypto Service (Flux)

This service is responsible for **all crypto-market data ingestion, aggregation, and streaming** in the **Flux platform**.

It acts strictly as a **data producer**, not a real-time delivery layer. All client-facing fan-out, caching, and delivery are handled by the **Flux BFF**.

---

## 🎯 Responsibilities

The crypto-service owns:

* Fetching market data from **CoinGecko** (REST)
* Streaming real-time tickers from **Coinbase** (WebSocket)
* Computing:

  * Top gainers
  * Top losers
  * Top tradable coins
* Publishing **Kafka events** for downstream consumers
* Applying rate-limits, circuit breakers, and backpressure

It does **not**:

* Talk to clients
* Manage WebSocket rooms
* Perform UI-level aggregation
* Cache data for client hydration

Those responsibilities belong to the BFF.

---

## 🧠 High-Level Architecture

> This service **produces data only**. It never delivers data directly to clients.

```
External APIs
  │
  ├─ CoinGecko (REST)
  ├─ Coinbase (WebSocket)
  │
  ▼
Crypto Service
  │
  ├─ Rate limiting (Bottleneck)
  ├─ Circuit breaker (CoinGecko)
  ├─ WS fan-in & batching (Coinbase)
  │
  ▼
Kafka Events
```

---

## 📦 Directory Structure

```
crypto-service/
│
├── src/
│   ├── modules/
│   │   ├── topGainers.ts
│   │   ├── topLosers.ts
│   │   ├── topMarketsTicker.ts
│   │   ├── topMoversConsumer.ts
│   │   ├── topCoinsConsumer.ts
│   │   └── coinbaseWsClient.ts
│   │
│   ├── cache/               # Valkey helpers (optional cache)
│   ├── interfaces/          # Domain interfaces
│   ├── mappers/             # API → domain transformations
│   ├── schemas/             # Zod schemas for external payloads
│   ├── logger/              # Structured logging (pino)
│   ├── kafkaHealth.ts       # Kafka availability tracking
│   └── index.ts             # Service bootstrap
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 🔄 Kafka Integration

### Command Topics (Consumed)

| Topic                                      | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `crypto.service.command.topmovers.refresh` | Trigger recomputation of top gainers / losers |
| `crypto.service.command.topcoins.refresh`  | Trigger top coins snapshot publish            |

Commands represent **intent**, not guaranteed execution.

---

### Event Topics (Produced)

| Topic                           | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| `crypto.movers.event.updated`   | Top gainers & losers snapshot                           |
| `crypto.topcoins.event.updated` | Top tradable coins snapshot                             |
| `crypto.ticker.event.updated`   | Near-realtime price ticks (streamed, not cached at BFF) |

All events are **facts** and safe to replay.

---

## ⚡ Coinbase WebSocket Design

Coinbase imposes strict limits:

* Max **10 product_ids per connection**
* Max **8 unauthenticated messages / second**

### Strategy Used

* Multiple WebSocket connections (auto-scaled)
* Deterministic product → connection ownership
* Global rate-limiting for subscribe/unsubscribe
* Batched subscription flushing

### Ticker Coalescing

* Tick data is buffered per product
* Only the **latest tick per interval** is retained
* Batches are flushed to Kafka periodically

This prevents Kafka flooding while preserving freshness.

---

## 🧯 Circuit Breaker & Rate Limiting

### CoinGecko (REST)

* Circuit breaker opens after repeated failures
* Cooldown prevents hammering upstream
* Rate limiting via Bottleneck

If the circuit is open:

* API calls are skipped
* Cached or unavailable responses are returned

---

## 🗄 Caching Strategy

Valkey is used as an **optional accelerator**:

* Cache CoinGecko market snapshots
* Cache computed top movers
* Cache top tradable coins

If cache is unavailable:

* Service continues operating
* Fresh API calls are attempted

Cache **never** determines correctness.

---

## ⏱ Scheduling & Refresh

* Top movers are refreshed:

  * On Kafka command
  * On a periodic scheduler (~90s)

* Top coins are:

  * Precomputed at startup
  * Periodically re-published

This ensures freshness even without external triggers.

---

## 🔐 Kafka Reliability

* Idempotent producer enabled
* Explicit retry limits
* Kafka availability tracked via `KafkaHealth`
* Publishing skipped when Kafka is unavailable

This prevents backpressure from cascading failures.

---

## 🚦 Startup Sequence

1. Validate environment variables
2. Connect Kafka producer
3. Start Kafka consumers
4. Bootstrap Coinbase ticker subscriptions
5. Warm caches

The service is fully operational only after step 4.

---

## 🛑 Graceful Shutdown

On shutdown:

* Stop Coinbase WebSocket connections
* Flush & stop ticker batching
* Disconnect Kafka producer and consumers
* Close Valkey connection

This prevents:

* Partial publishes
* Zombie WebSocket connections
* Resource leaks

---

## 🧪 Testing Notes

Testing focuses on:

* Pure logic (sorting, filtering, mapping)
* Circuit breaker behavior
* Rate-limit safety
* Kafka boundary isolation

Most tests run **without Kafka or Redis**.

---

## ✅ Summary

The crypto-service is:

* A high-throughput data ingestion service
* Designed for hostile upstream APIs
* Kafka-first and client-agnostic
* Producer-only by contract
* Optimized for correctness over convenience

It provides clean, reliable crypto data to the Flux platform.
