# Flux – Socket Events

This document describes **all Socket.IO events** used in the Flux platform, including:

* Client → BFF events
* BFF → Client events
* Room strategy and scoping

The goal is to make the real-time contract between **frontend and backend explicit, predictable, and debuggable**, while hiding Kafka and service internals from the client.

---

## 🧭 Design Principles

* Single persistent Socket.IO connection per client
* Events are **domain-scoped**, not generic
* Rooms are used for **selective fan-out**, not blind broadcasting
* Clients never interact with Kafka or domain services directly
* Socket events represent **state delivery**, not commands

---

## 🔌 Connection Lifecycle

### `connection`

Triggered automatically when a client establishes a Socket.IO connection.

**BFF behavior:**

* Logs connection metadata
* Prepares socket for room joins and hydration

---

### `disconnect`

Triggered when a client disconnects.

**Payload:**

```json
"transport close" | "client disconnect" | "ping timeout"
```

**BFF behavior:**

* Logs disconnect reason
* No explicit cleanup required (rooms auto-release)

---

## 📤 Client → BFF Events

These events represent **user intent**.

---

### `session:init` *(Handshake & Identity)*

> [!NOTE]
> The legacy `getUserId` event is **Deprecated / Removed**.

Identity is now established during the initial Socket.IO connection handshake:

1. **Client Handshake**: Client sends `auth: { guestId }` during connection (resolved from `localStorage` under `flux_guest_id`).
2. **Server Middleware**: Resolves identity and binds context to `socket.data.user = { id, type, ip }`.
3. **`session:init` (BFF → Client)**: Emitted by BFF immediately upon connection.

**Payload:**

```json
{
  "userId": "uuid-or-guestId",
  "userType": "guest"
}
```

---

### `userLocationUpdate`

Send user location data to the backend.

**Payload:**

```json
{
  "city": "Delhi",
  "region": "Delhi",
  "country": "IN",
  "lat": "28.61",
  "lon": "77.20",
  "ip": "x.x.x.x"
}
```

> [!NOTE]
> `userId` is **no longer passed as a parameter**; it is resolved automatically on the server from `socket.data.user.id`.

**BFF behavior:**

* Deduplicates rapid duplicate updates
* Joins city-specific weather room
* Joins global crypto, news, and stock rooms
* Publishes `weather.service.command.fetch` to Kafka

---

### `cryptoTopMoversRequest`

Request latest crypto top gainers / losers snapshot.

**BFF behavior:**

* Responds immediately from cache if available
* Triggers Kafka refresh if cache is missing

---

### `cryptoTopCoinsRequest`

Request snapshot of top cryptocurrencies.

**BFF behavior:**

* Responds from cache if available
* Otherwise waits for next Kafka event

---

### `stockTopPerformersRequest`

Request top performing stocks.

**BFF behavior:**

* Responds from cache if available
* Does **not** synchronously trigger Kafka
* Background refresh handled by scheduler

---

### `topNewsRequest`

Request latest global news.

**BFF behavior:**

* Responds from cache if available
* Otherwise triggers Kafka refresh

---

## 📥 BFF → Client Events

These events represent **state updates** pushed to clients.

---

### 🌦 Weather

#### `weather.{city}.update`

**Room:** `weather.{city}`

**Payload:**

```json
{
  "status": "success",
  "data": { /* weather data */ }
}
```

---

### 💹 Crypto

#### `cryptoTopMoversResponse`

**Room:** `crypto.global`

**Payload:**

```json
{
  "status": "success",
  "data": {
    "topGainers": [],
    "topLosers": []
  }
}
```

---

#### `cryptoTopCoinsResponse`

**Room:** `crypto.global`

**Payload:**

```json
{
  "status": "success",
  "data": {
    "topCoins": []
  }
}
```

---

#### `cryptoTickerResponse`

**Room:** `crypto.global`

**Notes:**

* High-frequency event stream
* Cached as a short-lived snapshot (`crypto:tickers`, TTL 300s) for immediate client hydration on connect
* Relayed live from crypto-service (Coinbase feed)

---

### 📰 News

#### `newsUpdate`

**Room:** `news.global`

**Payload:**

```json
{
  "status": "success",
  "scope": "global",
  "data": []
}
```

---

### 📈 Stocks

#### `stockTopPerformersResponse`

**Room:** `stock.global`

**Payload:**

```json
{
  "status": "success",
  "data": []
}
```

---

## 🏠 Room Strategy Summary

| Room             | Purpose                       |
| ---------------- | ----------------------------- |
| `weather.{city}` | City-specific weather updates |
| `crypto.global`  | All crypto data               |
| `news.global`    | Global news                   |
| `stock.global`   | Stock performers              |

Rooms ensure clients only receive relevant data.

---

## 🔁 Cache-backed Hydration

On room join:

* BFF immediately emits cached state (if available)
* Prevents blank UI on reconnect
* Avoids race conditions with Kafka

Hydration is **best-effort** and never blocks live updates.

---

## ❌ Error & Loading States

Socket responses may include:

```json
{
  "status": "loading" | "error",
  "message": "Human-readable message"
}
```

This keeps frontend state handling simple and explicit.

---

## ✅ Summary

Socket.IO in Flux acts as:

* A real-time delivery layer
* A controlled fan-out mechanism
* A boundary that hides backend complexity

All socket events are designed to be **predictable, scoped, resilient, and easy to reason about**.
