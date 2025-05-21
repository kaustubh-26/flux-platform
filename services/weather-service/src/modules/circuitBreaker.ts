const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export function canCall(): boolean {
  return Date.now() > breakerOpenUntil;
}

export function recordSuccess(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

export function recordFailure(): void {
  consecutiveFailures++;

  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    breakerOpenUntil = Date.now() + COOLDOWN_MS;
  }
}

/**
 * Test-only helpers (optional but recommended)
 */
export function __resetBreaker() {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

export function __getBreakerState() {
  return {
    consecutiveFailures,
    breakerOpenUntil,
  };
}
