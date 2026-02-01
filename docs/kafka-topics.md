# Flux – Kafka Topics

This document defines **all Kafka topics** used in the Flux platform, their purpose, ownership, and communication patterns.

Flux follows a strict **Command → Event** messaging model to ensure loose coupling, observability, and horizontal scalability.

---

## 🧭 Topic Naming Conventions

```
<domain>.<service>.command.<action>
<domain>.<service>.event.<state>
```

Examples:

* `weather.service.command.fetch`
* `crypto.ticker.event.updated`

### Why this matters

* Clear ownership
* Easy filtering in Kafka tooling
* Predictable, evolvable contracts

---

## 📤 Command Topics

Command topics express **intent**. They do not guarantee an outcome — only that a request was made.

All command topics are:

* **Produced exclusively by the BFF**
* **Consumed by exactly one domain service**
* Fire-and-forget by design

---

### 🌦 Weather

#### `weather.service.command.fetch`

**Produced by:** BFF
**Consumed by:** weather-service

**Purpose:**

* Request weather data for a user’s location

**Payload (example):**

```json
{
  "event": "locationUpdate",
  "userId": "uuid",
  "data": {
    "city": "Delhi",
    "lat": "28.61",
    "lon": "77.20"
  },
  "timestamp": "2026-01-31T10:00:00Z"
}
```

---

### 💹 Crypto

#### `crypto.service.command.topmovers.refresh`

**Produced by:** BFF
**Consumed by:** crypto-service

**Purpose:**

* Trigger refresh of top gainers / losers

---

#### `crypto.service.command.topcoins.refresh`

**Produced by:** BFF
**Consumed by:** crypto-service

**Purpose:**

* Trigger refresh of top coins snapshot

---

### 📰 News

#### `news.service.command.refresh`

**Produced by:** BFF
**Consumed by:** news-service

**Purpose:**

* Fetch latest global news

---

### 📈 Stocks

#### `stock.service.command.topperformers.refresh`

**Produced by:** BFF
**Consumed by:** stock-service

**Purpose:**

* Refresh top performing stocks

---

## 📥 Event Topics

Event topics represent **facts** — something that already happened.

They are:

* Emitted by domain services
* Consumed by the BFF
* Replayable and observable

---

### 🌦 Weather

#### `weather.service.event.updated`

**Produced by:** weather-service
**Consumed by:** BFF

**Purpose:**

* Publish latest weather data

**Payload (example):**

```json
{
  "status": "success",
  "data": {
    "city": "Delhi",
    "temperature": 32,
    "humidity": 60
  }
}
```

---

### 💹 Crypto

#### `crypto.movers.event.updated`

**Produced by:** crypto-service
**Consumed by:** BFF

**Purpose:**

* Publish top gainers and losers snapshot

---

#### `crypto.topcoins.event.updated`

**Produced by:** crypto-service
**Consumed by:** BFF

**Purpose:**

* Publish top cryptocurrency snapshot

---

#### `crypto.ticker.event.updated`

**Produced by:** crypto-service
**Consumed by:** BFF

**Purpose:**

* Publish near‑realtime ticker updates

**Notes:**

* High‑frequency event stream
* **Not cached at the BFF**
* Relayed directly to connected clients
* Snapshot semantics do not apply

---

### 📰 News

#### `news.service.event.updated`

**Produced by:** news-service
**Consumed by:** BFF

**Purpose:**

* Publish latest global news articles

---

### 📈 Stocks

#### `stock.service.event.updated`

**Produced by:** stock-service
**Consumed by:** BFF

**Purpose:**

* Publish top stock performers

---

## 🔁 Consumption Model

* Each consumer group is **domain-specific**
* Services never consume each other’s topics
* The BFF is the only **multi-domain consumer**

This prevents cross-service coupling while allowing centralized fan-out.

---

## 🔐 Ordering & Delivery Guarantees

* Kafka guarantees **partition ordering**
* Flux assumes **at-least-once delivery**
* Consumers are idempotent where required

Exactly-once semantics are intentionally avoided.

---

## 🧠 Design Notes

* Commands are intent-based and fire-and-forget
* Events are fact-based and replayable
* Topics double as an audit and debugging surface
* High-frequency streams (e.g. crypto tickers) are treated differently from snapshot-based domains

---

## ✅ Summary

Kafka in Flux acts as:

* A decoupling layer
* A scalability boundary
* A reliability backbone

It is **not** used as a synchronous API or request/response transport.
