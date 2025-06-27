# News Service (Flux)

This service is responsible for **fetching, normalizing, caching, and publishing global news data** for the **Flux platform**.

It acts as a **Kafka data producer**, aggregating external news APIs and emitting clean, UI-ready events for downstream consumers (primarily the **Flux BFF**).

This service **never delivers data directly to clients**.

---

## 🎯 Responsibilities

The news-service owns:

* Fetching news from **NewsData.io** (REST API)
* Normalizing heterogeneous API payloads into a stable `NewsCard` model
* Applying **rate limiting**, **single-flight**, and **circuit breaking**
* Caching latest news snapshots (Valkey)
* Publishing news updates to Kafka
* Periodic refresh via scheduler

It does **not**:

* Serve clients directly
* Manage WebSocket connections or rooms
* Perform UI fan-out logic

---

## 🧠 High-Level Architecture

```
External API
  │
  ├─ NewsData.io (REST)
  │
  ▼
News Service
  │
  ├─ Rate limiting (Bottleneck)
  ├─ Single-flight de-duplication
  ├─ Circuit breaker
  ├─ Cache (Valkey)
  │
  ▼
Kafka Event
  │
  ▼
Flux BFF → WebSocket Clients
```

---

## 📦 Directory Structure

```
news-service/
│
├── src/
│   ├── modules/
│   │   ├── getNews.ts            # Fetch + normalize + cache news
│   │   ├── newsConsumer.ts       # Kafka command consumer
│   │   └── newsLimiter.ts        # API rate limiter
│   │
│   ├── cache/                    # Valkey helpers (optional cache)
│   ├── constants/                # Cache keys
│   ├── interfaces/               # Domain interfaces (NewsCard)
│   ├── schemas/                  # Zod schemas for API validation
│   ├── logger/                   # Structured logging (pino)
│   └── server.ts                 # Service bootstrap & lifecycle
│
├── tests/                        # Unit / integration tests
│
├── .env
├── Dockerfile
├── jest.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.test.json
└── README.md
```

---

## 🔄 Kafka Integration

### Command Topics (Consumed)

| Topic                          | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `news.service.command.refresh` | Trigger a news refresh (manual or BFF-driven) |

Commands represent **intent**, not guaranteed execution.

---

### Event Topics (Produced)

| Topic                        | Description                 |
| ---------------------------- | --------------------------- |
| `news.service.event.updated` | Latest global news snapshot |

Each event contains:

* Scope (`global`)
* Source (`api` or `cache`)
* Timestamp
* Normalized articles

Events are **facts** and safe to replay.

---

## ⚡ Rate Limiting & Single-Flight

The upstream News API is **heavily rate-limited**:

* ~8 requests per hour (free tier)

### Strategies used:

* **Bottleneck** enforces strict rate limits
* Cache is checked *before* rate limiting
* Single-flight ensures only one in-flight fetch per cache key

This prevents:

* API exhaustion
* Duplicate upstream calls
* Thundering herd problems

---

## 🧯 Circuit Breaker

A simple circuit breaker protects the News API:

* Opens after 3 consecutive failures
* Cooldown period of ~15 minutes
* Cache is still served when available

When open:

* Network calls are skipped
* The system degrades gracefully

---

## 🗄 Caching Strategy

Valkey is used as an **optional performance accelerator**:

* Stores latest news snapshots per scope
* TTL: ~12 minutes

If cache is unavailable:

* Fresh API calls are attempted (subject to rate limits)
* The service continues operating

Cache is **never authoritative**.

---

## ⏱ Scheduling & Refresh

The service refreshes news via:

* Kafka command (`news.service.command.refresh`)
* Periodic scheduler (~8 minutes)
* Initial fetch on startup

This ensures news stays reasonably fresh even without external triggers.

---

## 🔐 Kafka Reliability

* Idempotent Kafka producer
* Explicit retry configuration
* Safe reconnect loop for Kafka outages

If Kafka is unavailable:

* News fetch may still occur
* Publishing is skipped until Kafka recovers
* No client-visible delivery happens without Kafka

---

## 🚦 Startup Sequence

1. Validate environment variables
2. Connect Kafka producer & consumer
3. Start Kafka command consumer
4. Start periodic scheduler
5. Perform initial news fetch

---

## 🛑 Graceful Shutdown

On shutdown:

* Stop scheduler
* Disconnect Kafka consumer and producer
* Close HTTP agents
* Exit cleanly

This avoids duplicate publishes and partial refreshes.

---

## 🧪 Testing Notes

Testing focuses on:

* News normalization logic
* Cache hit / miss behavior
* Circuit breaker transitions
* Rate limit enforcement

Most tests run **without Kafka or Redis**.

---

## ✅ Summary

The news-service is:

* Defensive against hostile rate limits
* Cache-accelerated but cache-independent
* Kafka-first and client-agnostic
* Producer-only by contract
* Designed for correctness and resilience

It provides **normalized, UI-ready news events** to the rest of the Flux platform.
