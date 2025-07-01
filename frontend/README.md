# Frontend (Flux UI)

The frontend is a **real-time, socket-driven dashboard UI** for **Flux**, visualizing live data from the backend ecosystem (Weather, News, Stocks, Crypto).

It does **not** call microservices directly.
All data flows through the **Flux BFF (Backend-for-Frontend)** via **Socket.IO**, making the UI reactive, resilient, and backend-agnostic.

---

## 🎯 Responsibilities

The frontend is responsible for:

* Rendering a real-time dashboard (Weather, News, Stocks, Crypto)
* Managing a **single persistent Socket.IO connection**
* Emitting user intent (location, data requests)
* Hydrating UI from cached + live socket events
* Handling reconnection, partial data, and loading states
* Presenting responsive layouts (mobile → desktop)

It does **not**:

* Talk to Kafka
* Call domain services directly
* Implement caching, retries, or circuit breakers

Those concerns are handled server-side by the BFF and services.

---

## 🧠 Data Flow (End-to-End)

```
Domain Services
  (Weather / News / Stock / Crypto)
          │
          ▼
        Kafka
          │
          ▼
      Flux BFF
          │  (Socket.IO events)
          ▼
      Frontend UI
```

Key principles:

* Frontend is **event-driven**, not request/response-heavy
* Initial data is hydrated immediately (cache-backed where applicable)
* Live updates stream in continuously as events

---

## 🔌 Socket Architecture

The frontend uses a **singleton Socket.IO client** configured for same‑origin connections and reverse‑proxy compatibility.

### Connection Model

* A **single Socket.IO client** is shared across the app
* Socket lifecycle is managed by `SocketProvider`
* Reconnection is automatic and infinite

```ts
<SocketProvider>
  <App />
</SocketProvider>
```

### Socket Configuration Notes

* No explicit server URL is provided
* Socket connects to the current origin
* Path is fixed to `/socket.io`
* WebSocket upgrade handled by Nginx
* Automatic reconnection with exponential backoff


### User Readiness Flow

1. Socket connects
2. Client resolves user location
3. Client receives or generates a unique user ID
4. `userLocationUpdate` is emitted
5. UI becomes `userReady`
6. Data subscriptions begin

Until this completes, the UI shows a **connection screen**.

---

## 📦 Directory Structure

```
frontend/
├── dist/                   # Production build output
├── public/                 # Static assets
│
├── src/
│   ├── assets/             # Images, icons
│   ├── components/         # UI cards (Weather, News, Stock, Crypto)
│   ├── context/            # SocketProvider & socket state
│   ├── hooks/              # Data hooks (weather, crypto, stocks, news)
│   ├── interfaces/         # TypeScript contracts for socket payloads
│   ├── pages/              # Pages (Dashboard)
│   ├── socket/             # Socket singleton & core event handlers
│   ├── utils/              # LocalStorage, helpers
│   │
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
│
├── tests/                  # Unit & integration tests
│
├── nginx.conf              # Production Nginx config
├── Dockerfile              # Multi-stage frontend build
│
├── index.html
├── package.json
├── package-lock.json
│
├── jest.config.ts
├── jest.setup.ts
│
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tsconfig.spec.json
│
├── vite.config.ts
├── eslint.config.js
├── .env
├── .gitignore
└── README.md
```

---

## 🪝 Hooks Design Philosophy

All data hooks follow the same pattern:

* Subscribe to a socket event
* Emit an initial request (if applicable)
* Update local state on incoming events
* Cleanup listeners on unmount

Example categories:

* **Pull + stream**: weather updates, crypto tickers
* **Request + hydrate**: news, crypto movers, top coins, stock performers

Hooks never:

* Mutate global state
* Cache data manually
* Retry network calls

---

## 🧩 UI Composition

The dashboard is composed of **independent cards**:

* WeatherCard
* NewsCard
* StockCard
* CryptoCard

Each card:

* Owns its own hook(s)
* Handles loading / empty states
* Is resilient to partial data

Cards can fail independently without breaking the page.

---

## 📡 Socket Events (Consumed)

The frontend listens to the following events (see `docs/socket-events.md`):

* `weather.*.update`
* `newsUpdate`
* `stockTopPerformersResponse`
* `cryptoTopMoversResponse`
* `cryptoTopCoinsResponse`
* `cryptoTickerResponse`

> **Note:** Crypto ticker updates are streamed live from the crypto-service and are **not cache-hydrated**.

The frontend never assumes delivery order and always renders the **latest payload**.

---

## 🌍 Location Handling

* Location is resolved via `ipwho.is`
* Offline fallback defaults to **New Delhi**
* Location updates are debounced before emitting

This avoids spamming the backend while remaining responsive.

---

## 🧪 Testing Strategy

Frontend tests focus on:

* Component rendering
* Hook behavior
* Socket event handling
* Loading / empty states

Testing avoids real sockets by mocking the socket client.

See root `TESTING.md` for overall testing philosophy.

---

## ⚙️ Local Development

```bash
npm install
npm run dev
````

### Environment Variables

When running behind **Nginx (Docker / production)**, the frontend intentionally does **not** configure a backend URL.

```env
# Intentionally empty when using Nginx reverse proxy
VITE_SERVER_URI=
```

Socket.IO connects to the **same origin** and is proxied by Nginx to the BFF at `/socket.io`.

This design:

* Avoids hard‑coding backend URLs
* Works across local Docker Compose and production
* Keeps frontend deployment backend‑agnostic

The frontend expects the **BFF** to be reachable via the Nginx proxy.

---

## 🛑 Failure Handling

The UI is designed to:

* Survive socket disconnects
* Rehydrate automatically on reconnect
* Render partial data safely
* Never crash due to missing payloads

Visual indicators (skeletons, loaders) communicate state clearly.

---

## ✅ Summary

The frontend is:

* Socket-first, not REST-driven
* Event-hydrated and resilient
* Fully typed and modular
* Decoupled from backend internals

It acts as a **real-time visualization layer** for Flux, not a business-logic layer.
