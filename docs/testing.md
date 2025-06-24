# Testing Philosophy

This document explains the testing strategy used in this repository and the reasoning behind it. The goal is to keep tests **reliable**, **fast**, and **meaningful**, while avoiding brittle or redundant coverage.

---

## Core Principles

1. **Test behavior, not implementation details**
2. **Each layer is tested at the correct boundary**
3. **Integration tests validate wiring, not internals**
4. **Infrastructure is tested once, in isolation**
5. **Tests must be deterministic and repeatable**

---

## Test Types Used

### 1. Unit Tests

**Purpose**

* Validate pure logic and defensive behavior
* Verify edge cases and error handling

**Characteristics**

* No real infrastructure (Kafka, Redis, sockets, network)
* Heavy use of mocks and stubs
* Fast and deterministic

**Examples**

* Payload validation
* Branch handling (missing fields, invalid JSON)
* Conditional logic
* Logging paths

> Unit tests answer: *"Does this function behave correctly in isolation?"*

---

### 2. Integration Tests

**Purpose**

* Validate interaction between real components
* Ensure wiring between systems works as expected

**Characteristics**

* Uses real infrastructure via Testcontainers (Kafka, Valkey)
* Avoids mocking core infrastructure
* One integration test per consumer or adapter
* Slower than unit tests, but highly reliable

**Examples**

* Kafka → Consumer → Socket.IO flow
* Kafka producer publishing to a topic
* Cache read/write behavior with real Valkey

> Integration tests answer: *"Do these components work together correctly?"*

---

### 3. What Is NOT Considered an Integration Test

The following are intentionally **not** tested at the integration level:

* Kafka internals (offsets, partition assignment)
* Redis internals (retry strategy, socket lifecycle)
* Logging output correctness
* Performance characteristics

These are either:

* responsibilities of third-party libraries, or
* better validated through monitoring in production

---

## Kafka Consumer Testing Strategy

### Unit Tests (per consumer)

Unit tests validate:

* Payload validation
* Defensive behavior (invalid JSON, missing fields)
* Correct cache calls
* Correct Socket.IO emission logic

Kafka is fully mocked.

---

### Integration Tests (per consumer)

Each Kafka consumer has **exactly one integration test**.

That test verifies:

* Consumer subscribes to the correct topic
* A real Kafka message is consumed
* Socket.IO emits the correct event to the correct room

**Important constraints**

* `fromBeginning: true` is enabled only in tests (for determinism)
* Production defaults always use `fromBeginning: false`

> Integration tests validate **wiring**, not Kafka behavior.

---

## Cache (Valkey / Redis) Testing Strategy

### Why Cache Has Integration Tests

The cache module:

* Manages a real Redis connection
* Tracks availability state
* Handles TTLs
* Performs graceful degradation

This behavior cannot be reliably validated with mocks.

---

### Cache Integration Tests Validate

* Cache becomes available when Redis is reachable
* `cacheSet` and `cacheGet` work end-to-end
* TTL expiration behaves correctly
* Cache operations safely no-op when unavailable

### What Cache Tests Do NOT Validate

* Exact timing of connection events
* Internal Redis retry behavior
* Logging output

---

## Graceful Degradation Philosophy

For infrastructure components (Kafka, Redis):

* Failures must **never crash the application**
* Operations should **degrade to no-ops** when unavailable
* Tests assert **behavior**, not internal flags

Example:

* After cache shutdown, tests verify that `cacheGet` returns `null`
* Tests do NOT assert immediate availability state changes

---

## Logging in Tests

* Logs are **silenced** in the test environment
* This keeps test output readable and focused
* Logging behavior remains unchanged in development and production

---

## Open Handles in Tests

* Infrastructure clients (Kafka, Redis) keep sockets and timers open
* Jest may report open handles after tests complete

This is expected and acceptable.

**Policy**

* Production code is never changed to satisfy Jest
* Integration tests may disable `detectOpenHandles`
* Focus remains on correctness, not forced teardown

---

## Why This Strategy

This approach:

* Scales well as the system grows
* Keeps CI stable
* Avoids flaky tests
* Makes failures meaningful
* Matches real-world backend engineering practices

---

## Summary

* Unit tests validate logic
* Integration tests validate wiring
* Infrastructure is tested once, in isolation
* Behavior is more important than internal state
* Tests exist to build confidence, not to inflate coverage

---

**This testing strategy is intentional and opinionated.**
It prioritizes long-term maintainability and production confidence over exhaustive or redundant testing.
