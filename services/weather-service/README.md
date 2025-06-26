# Weather Service (Flux)

The weather-service is responsible for **fetching, normalizing, caching, and publishing city-level weather data** for the **Flux platform**.

It acts as a **request-driven Kafka worker**, reacting to location updates from the **Flux BFF** and emitting weather snapshots for downstream real-time delivery.

The service is **producer-only** by design and never delivers data directly to clients.

---

## 🎯 Responsibilities

The weather-service owns:

* Fetching weather data from **WeatherAPI** (REST)
* Validating and normalizing API responses
* Applying a circuit breaker for upstream failures
* Caching per-city weather snapshots (Valkey)
* Publishing weather updates to Kafka

It does **not**:

* Maintain WebSocket connections
* Perform client fan-out or room management
* Stream continuous updates without demand

All delivery, fan-out, and client hydration are handled by the **Flux BFF**.

---

## 🧠 High-Level Architecture

```
Client Location Update
        │
        ▼
      Flux BFF
        │  (Kafka command)
        ▼
Weather Service
  │
  ├─ Cache (Valkey)
  ├─ Circuit breaker
  ├─ WeatherAPI fetch
  │
  ▼
Kafka Event (weather.service.event.updated)
        │
        ▼
      Flux BFF → WebSocket Clients
```

> This service responds **only on demand**. There is no polling or push without a command.

---

## 📦 Directory Structure

```
weather-service/
│
├── src/
│   ├── cache/                 # Valkey helpers (optional cache)
│   ├── interfaces/            # Location & weather domain types
│   ├── logger/                # Structured logging (pino)
│   ├── modules/               # Weather domain logic
│   │   ├── circuitBreaker.ts  # API circuit breaker
│   │   ├── getWeather.ts      # External WeatherAPI fetch
│   │   ├── weather.ts         # WeatherService orchestration
│   │   └── weatherConsumer.ts # Kafka command consumer
│   │
│   ├── schemas/               # Zod schemas for API validation
│   ├── utils/                 # Time & forecast helpers
│   └── server.ts              # Service bootstrap & lifecycle
│
├── tests/                     # Unit / integration tests
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

| Topic                           | Purpose                         |
| ------------------------------- | ------------------------------- |
| `weather.service.command.fetch` | Request weather data for a city |

Each command contains a **validated location payload**.

---

### Event Topics (Produced)

| Topic                           | Description                 |
| ------------------------------- | --------------------------- |
| `weather.service.event.updated` | Weather snapshot for a city |

Each event contains:

* Status (`success` or `unavailable`)
* Source (`cache` or `api`)
* Normalized weather data
* Timestamp

Events are **facts** and safe to replay.

---

## 🗄 Caching Strategy

Valkey is used as a **best-effort accelerator**:

* Cache key: `weather:{city}`
* TTL: ~6 hours

Cache behavior:

* Checked first for fast responses
* Written after successful API fetch
* Safely ignored if unavailable

Cache is **never authoritative** and never blocks fresh computation.

---

## 🧯 Circuit Breaker

The WeatherAPI is protected by a lightweight circuit breaker:

* Opens after 3 consecutive failures
* Cooldown period: ~60 seconds
* Cache may still serve data while open

When open:

* API calls are skipped
* Service responds with `unavailable`

This prevents cascading failures under upstream instability.

---

## ⏱ Request Flow

1. Flux BFF sends `weather.service.command.fetch`
2. Payload is validated (city, region, IP)
3. Cache lookup (fast path)
4. Circuit breaker guard
5. External API fetch (if needed)
6. Cache update (best effort)
7. Event published to Kafka

This keeps weather requests **on-demand, efficient, and bounded**.

---

## 🔐 Kafka Reliability

* Idempotent Kafka producer
* Safe reconnect loop
* Automatic recovery on broker restarts

If Kafka is unavailable:

* Weather fetch may still occur
* Publishing is skipped until Kafka recovers

No data is buffered indefinitely.

---

## 🚦 Startup Sequence

1. Validate environment variables
2. Connect Kafka producer & consumer
3. Start weather command consumer
4. Wait for requests (no polling)

The service remains idle until a command is received.

---

## 🛑 Graceful Shutdown

On shutdown:

* Close Valkey connection
* Disconnect Kafka producer and consumer
* Exit cleanly

This avoids partial publishes and resource leaks.

---

## 🧪 Testing Notes

Testing focuses on:

* Circuit breaker transitions
* Cache hit / miss behavior
* Weather data normalization
* Kafka consumer boundaries

Tests avoid real API calls by mocking WeatherAPI responses.

---

## ✅ Summary

The weather-service is:

* Request-driven, not poll-based
* Snapshot-oriented, not streaming
* Cache-accelerated but cache-independent
* Defensive against flaky external APIs
* Kafka-first and client-agnostic
* Producer-only by contract

It provides reliable, city-level weather data to the Flux platform.
