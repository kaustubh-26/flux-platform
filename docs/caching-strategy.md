# Flux – Caching Strategy

This document explains how caching is used in **Flux**, **what problems it solves**, and — just as importantly — **what it is *not* responsible for**.

The system uses **Valkey (Redis-compatible)** as a *performance accelerator*, not a source of truth.

---

## 🎯 Design Intent

The cache exists to:

* Reduce perceived latency for clients
* Prevent cold-start UI states
* Protect downstream services
* Smooth bursty real-time traffic

The cache **must never**:

* Determine correctness
* Block real-time updates
* Become a single point of failure

This principle drives every caching decision.

---

## 🧠 Cache Philosophy: Optional, Not Critical

Flux is explicitly designed to **run without cache**.

If Valkey becomes unavailable:

* The BFF logs a warning
* Cache reads return `null`
* Cache writes are safely ignored
* Real-time flow continues via Kafka

This results in:

* Slightly higher latency
* No loss of correctness

This trade-off is intentional.

---

## 🧱 Where Cache Is Used

### 1️⃣ Client Hydration (Reconnects & Joins)

When a client:

* Connects
* Joins a room
* Refreshes the page

The BFF:

* Reads the latest cached snapshot (if present)
* Emits it immediately to the client

This avoids:

* Blank dashboards
* Waiting for the next Kafka event

Hydration is **best-effort** and never blocks real-time delivery.

---

### 2️⃣ Short-lived Realtime Snapshots

Some domains produce frequent updates, but **not all of them are cached**.

**Cached domains (snapshots):**

| Domain              | Cached at BFF | TTL          |
| ------------------- | ------------- | ------------ |
| Crypto movers       | ✅ Yes         | ~5 minutes   |
| Crypto top coins    | ✅ Yes         | ~5 minutes   |
| News                | ✅ Yes         | ~10 minutes  |
| Stocks (top movers) | ✅ Yes         | ~1–5 minutes |

**Not cached:**

| Domain         | Reason                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Crypto tickers | Live streamed via WebSocket from crypto-service (Coinbase feed). No snapshot semantics, high-frequency updates, caching adds no value. |

Cached snapshots are:

* Overwritten frequently
* Never merged
* Safe to drop

They exist purely to improve perceived responsiveness.

---

### 3️⃣ Deduplication Windows

User-generated events (such as location updates) can be noisy.

To prevent:

* Kafka overload
* Downstream service spam

The BFF:

* Hashes the payload
* Stores last-seen value in cache
* Ignores duplicates within a short time window

This deduplication is:

* Time-bound
* Best-effort
* Non-critical

Loss of deduplication degrades efficiency, not correctness.

---

## 🧱 Shared Cache Access

The Valkey cache is **shared across components**:

* BFF
* Weather service
* Crypto service
* Stock service
* News service

Services use the cache opportunistically for:

* Short-lived snapshots
* Temporary deduplication state

No service treats the cache as authoritative.

---

## 🔑 Cache Key Strategy

Keys are:

* Namespaced by domain
* Explicit and readable
* TTL-bound

Examples:

````text
bff:crypto:top-movers
bff:crypto:top-coins
bff:news:global
bff:stocks:top-performers
loc_dedup:{userId}
```text
bff:crypto:top-movers
bff:crypto:top-coins
crypto:tickers
bff:news:global
bff:stocks:top:performers
loc_dedup:{userId}
````

This avoids collisions and simplifies debugging.

---

## ⏳ TTL Strategy

TTL values are chosen based on **user perception**, not freshness guarantees.

Principles:

* Short TTL for high-frequency data
* Longer TTL for coarse snapshots
* Always safe to expire early

No cache entry is relied upon beyond its TTL.

---

## ⚠️ Error Handling & Degraded Mode

All cache interactions are wrapped defensively:

* Failures are logged
* Errors are swallowed
* No retries block the event loop

The system prefers:

> "Serve stale data or nothing — never block real-time flow"

---

## 🧪 Testing Implications

Because cache usage is optional:

* Most unit tests mock it entirely
* Integration tests assume cache may return `null`
* No test relies on cache correctness

This keeps tests fast, deterministic, and infrastructure-light.

---

## 🚫 Non-goals

The cache is **not** used for:

* Event sourcing
* Long-term storage
* Cross-service coordination
* Exactly-once guarantees

Those concerns belong elsewhere.

---

## ✅ Summary

Caching in Flux is:

* Opportunistic
* Disposable
* Non-authoritative

It improves UX and performance without compromising correctness, resilience, or architectural clarity.
