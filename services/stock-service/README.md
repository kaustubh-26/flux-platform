# Stock Service (Flux)

The stock-service is responsible for **fetching, ranking, caching, and publishing stock market top performers** for the **Flux platform**.

It aggregates data from an external market data provider (**Finnhub**), applies rate limits and defensive controls, and publishes **Kafka snapshot events** consumed by the **Flux BFF**.

The service is **producer-only** by design and never delivers data directly to clients.

---

## 🎯 Responsibilities

The stock-service owns:

* Fetching stock quotes from **Finnhub** (REST API)
* Computing top gainers and top losers
* Applying strict rate limiting and backoff
* Caching computed snapshots (Valkey)
* Publishing stock performance snapshots to Kafka
* Periodic refresh via scheduler

It does **not**:

* Serve HTTP or WebSocket clients
* Perform UI fan-out or socket room logic
* Maintain long-lived streaming connections

All delivery, fan-out, and client hydration are handled by the **Flux BFF**.

---

## 🧠 High-Level Architecture

```
Finnhub API (REST)
        │
        ▼
Stock Service
        │
        ├─ Rate limiting & backoff
        ├─ Snapshot computation
        ├─ Optional cache (Valkey)
        │
        ▼
Kafka Events
        │
        ▼
Flux BFF → WebSocket Clients
```

> This service produces **snapshots**, not streams.

---

## 📦 Directory Structure

```
stock-service/
│
├── src/
│   ├── cache/              # Valkey helpers (optional cache)
│   ├── logger/             # Structured logging (pino)
│   ├── modules/            # Stock fetch, consumer, scheduler logic
│   │   ├── stockConsumer.ts
│   │   └── topPerformers.ts
│   ├── schemas/            # Zod schemas for API validation
│   └── server.ts           # Service bootstrap & lifecycle
│
├── tests/                  # Unit / integration tests
├── Dockerfile
├── jest.config.ts
├── tsconfig.json
├── tsconfig.test.json
├── package.json
└── README.md
```

---

## 🔄 Kafka Integration

### Command Topics (Consumed)

| Topic                                         | Purpose                                 |
| --------------------------------------------- | --------------------------------------- |
| `stock.service.command.topperformers.refresh` | Trigger recomputation of top performers |

Commands represent **intent**, not guaranteed execution.

---

### Event Topics (Produced)

| Topic                         | Description                      |
| ----------------------------- | -------------------------------- |
| `stock.service.event.updated` | Snapshot of top gainers & losers |

Each event contains:

* Market metadata
* Timestamp
* Top gainers and losers arrays

Events are **facts** and safe to replay.

---

## ⚡ Rate Limiting Strategy

The Finnhub free tier enforces strict limits (~30 requests/min).

### Strategy used:

* Sequential quote fetching
* Fixed delay (~2.1s) between requests
* Batch processing of predefined popular stocks

If rate limits are hit:

* Requests back off automatically
* Current batch degrades gracefully

Correctness is preferred over completeness.

---

## 📊 Performance Calculation

For each stock symbol:

* Fetch latest quote and previous close
* Compute absolute price change
* Compute percentage change
* Rank by configurable metric (default: % change)

Results are split into:

* **Top gainers**
* **Top losers**

The output is always a **complete snapshot**, never partial deltas.

---

## 🗄 Caching Strategy

Valkey is used as an **optional accelerator**:

* Cache key: `stock:top:performers`
* TTL: ~5 minutes

Cache behavior:

* Checked before API fetch (fast path)
* Skipped entirely if cache is unavailable
* Cache never blocks fresh computation

Cache is **never authoritative**.

---

## ⏱ Scheduling & Refresh

Top performers are refreshed via:

* Kafka command from the Flux BFF
* Periodic scheduler (~2 minutes)
* Initial fetch on service startup

The scheduler interval is tuned to:

* Respect upstream rate limits
* Complete full batches reliably

---

## 🔐 Kafka Reliability

* Idempotent Kafka producer enabled
* Explicit retry configuration
* Safe reconnect loop on Kafka failures

If Kafka is unavailable:

* Data may still be fetched
* Publishing is skipped until Kafka recovers

No data is buffered indefinitely.

---

## 🚦 Startup Sequence

1. Validate environment variables
2. Initialize Kafka producer
3. Start Kafka consumer
4. Perform initial data fetch
5. Start periodic scheduler

---

## 🛑 Graceful Shutdown

On shutdown:

* Stop scheduler
* Disconnect Kafka producer and consumer
* Close Valkey connection
* Destroy HTTP agents

This prevents partial publishes and resource leaks.

---

## 🧪 Testing Notes

Testing focuses on:

* Quote parsing and validation
* Performance calculation logic
* Cache hit / miss behavior
* Kafka publish boundaries

Tests avoid real API calls by mocking Finnhub responses.

---

## ✅ Summary

The stock-service is:

* Snapshot-oriented, not streaming
* Defensive against rate-limited APIs
* Cache-accelerated but cache-independent
* Kafka-first and client-agnostic
* Producer-only by contract

It provides reliable stock market performance data to the Flux platform.
