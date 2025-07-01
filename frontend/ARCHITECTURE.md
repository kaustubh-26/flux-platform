# Frontend Architecture

This document explains the architectural decisions behind the **Flux frontend**.

The frontend is intentionally designed as a **thin, event-driven UI layer** that reacts to live data streams from the **Flux BFF** via **Socket.IO**, running behind an Nginx reverse proxy.

It does not own business logic, orchestration, caching, or data-fetching strategies.

---

## Design Goals

* Single persistent real-time connection
* Same-origin Socket.IO (no hard-coded backend URLs)
* No direct service or Kafka access
* Independent, failure-isolated UI modules
* Minimal global state
* Predictable lifecycle and cleanup
* Graceful degradation under partial failure

---

## High-Level Architecture

Kafka
↓
Domain Services
↓
Flux BFF (Socket.IO)
↓
Nginx Reverse Proxy
↓
Frontend Socket Layer
↓
Feature Hooks
↓
UI Components

The frontend never communicates with backend services directly.
All data arrives via **Socket.IO events**, proxied through Nginx at the same origin.

---

## Socket Layer

### Socket Singleton

A single Socket.IO instance is created and reused for the lifetime
of the application.

Responsibilities:

* Same-origin connection handling
* WebSocket + polling transport negotiation
* Automatic reconnection with backoff
* Timeout and retry strategy

This prevents:

* Duplicate connections
* Race conditions
* Event handler leaks

The socket intentionally **does not specify a server URL** and always connects
via `/socket.io` on the current origin.

---

### Socket Provider

`SocketProvider` is the only place where:

* Socket lifecycle is managed
* Connection state is tracked
* Core socket events are registered

It exposes:

* `socket`
* `connected`
* `userReady`

No component or hook creates its own socket instance.

---

## User Readiness Lifecycle

The frontend follows an explicit readiness flow:

1. Socket connects
2. User ID is retrieved or generated
3. Client resolves and sends location metadata
4. Client is marked `userReady`
5. Feature hooks activate subscriptions

This ensures:

* No premature subscriptions
* No invalid requests
* Clean reconnect behavior

Until readiness completes, the UI shows a dedicated **connection screen**.

---

## Data Ownership Model

### Hooks Own Data

Each domain feature has a dedicated hook:

* Weather
* News
* Stocks
* Crypto

Hooks:

* Subscribe/unsubscribe to socket events
* Maintain feature-local state
* Normalize incoming payloads
* Expose render-ready data

Hooks **never render UI** and never cache data manually.

---

### Components Are Stateless

UI components:

* Receive already-processed data
* Handle layout, animation, and interaction
* Never touch sockets or global state

This makes components:

* Easy to test
* Easy to replace
* Easy to reason about

---

## Failure Isolation

Each dashboard card operates independently.

Failure in one stream:

* Does not block others
* Does not crash the app
* Is visually isolated

Examples:

* Weather API down → Weather card unavailable
* Crypto ticker lagging → Other cards still update
* Kafka temporarily unavailable → Cached snapshots still render

---

## Rendering Strategy

* Skeleton loaders for initial states
* Partial rendering as data arrives
* No global “loading” gate after readiness
* Mobile-first responsive layout

The UI remains usable even with incomplete or delayed data.

---

## State Management Philosophy

* No global state library
* No shared mutable stores
* Localized hook state only

Socket events are treated as:

> “Facts emitted by the system”

The frontend never attempts to derive, infer, or synthesize missing data.

---

## Cleanup & Memory Safety

All hooks:

* Register event handlers on mount
* Unregister on unmount

Socket connection:

* Is never force-disconnected during navigation
* Is cleaned up only on full app teardown

This avoids:

* Memory leaks
* Duplicate listeners
* Zombie subscriptions

---

## Non-Goals

This frontend intentionally does **not**:

* Aggregate or enrich data
* Retry business operations
* Persist long-term state
* Implement caching policies
* Perform request orchestration

Those responsibilities belong to the **Flux BFF** and domain services.

---

## Summary

The Flux frontend is:

* Event-driven
* Contract-based
* Failure-tolerant
* Same-origin and proxy-friendly
* Intentionally thin
* Easy to extend

New real-time features are added by:

1. Defining a socket contract
2. Adding a hook
3. Rendering a new card

Nothing else changes.
