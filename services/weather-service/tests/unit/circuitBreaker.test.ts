import {
  canCall,
  recordFailure,
  recordSuccess,
  __resetBreaker,
  __getBreakerState,
} from '@/modules/circuitBreaker';

describe('circuitBreaker (unit)', () => {
  beforeEach(() => {
    // Reset shared breaker state
    __resetBreaker();

    // Freeze time to make cooldown behavior deterministic
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - breaker starts in closed state
   * - calls are allowed
   */
  it('allows calls when breaker is closed', () => {
    expect(canCall()).toBe(true);
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - failures are tolerated up to the threshold
   * - breaker opens only after threshold is exceeded
   */
  it('blocks calls only after failure threshold is reached', () => {
    recordFailure();
    recordFailure();

    expect(canCall()).toBe(true);

    recordFailure(); // threshold reached
    expect(canCall()).toBe(false);
  });

  /**
   * Purpose:
   * Verifies Recovery behavior:
   * - calls are blocked during cooldown
   * - calls are allowed once cooldown expires
   */
  it('allows calls again after cooldown expires', () => {
    recordFailure();
    recordFailure();
    recordFailure();

    expect(canCall()).toBe(false);

    // Strict boundary: Date.now() must exceed breakerOpenUntil
    jest.advanceTimersByTime(60_001);

    expect(canCall()).toBe(true);
  });

  /**
   * Purpose:
   * Verifies State reset behavior:
   * - successful call clears failure count
   * - breaker is closed immediately
   */
  it('resets breaker state on success', () => {
    recordFailure();
    recordFailure();
    recordFailure();

    expect(canCall()).toBe(false);

    recordSuccess();

    const state = __getBreakerState();
    expect(state.consecutiveFailures).toBe(0);
    expect(state.breakerOpenUntil).toBe(0);
    expect(canCall()).toBe(true);
  });
});
