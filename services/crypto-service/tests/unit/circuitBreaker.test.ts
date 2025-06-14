// Mock logger to silence output and observe behavior
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { CircuitBreaker } from '@/modules/circuitBreaker';
import { logger } from '@/logger';

const FIXED_NOW = 1700000000000;

describe('CircuitBreaker (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - circuit breaker has no failures
   * - guard is invoked before an external call
   * - breaker allows execution
   */
  test('guard allows call when circuit is closed', () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      cooldownMs: 1000,
    });

    const allowed = breaker.guard();

    expect(allowed).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - consecutive failures reach the failure threshold
   * - circuit breaker opens
   * - subsequent calls are blocked during cooldown
   */
  test('guard blocks calls when circuit is open after failures', () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 2,
      cooldownMs: 5000,
    });

    breaker.failure(new Error('upstream error'));
    breaker.failure(new Error('upstream error'));

    const allowed = breaker.guard();

    expect(allowed).toBe(false);
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-breaker' }),
      'Circuit breaker open, skipping external call'
    );
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - failures occur but do not reach threshold
   * - circuit remains closed
   * - warning is logged instead of opening the circuit
   */
  test('does not open circuit before failure threshold is reached', () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      cooldownMs: 1000,
    });

    breaker.failure('timeout');

    const allowed = breaker.guard();

    expect(allowed).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-breaker',
        failures: 1,
      }),
      'External call failed'
    );
  });

  /**
   * Purpose:
   * Ensures correct behavior when:
   * - circuit was previously opened
   * - cooldown period has elapsed
   * - successful call resets the breaker
   */
  test('success resets circuit breaker after failures', () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 1,
      cooldownMs: 1000,
    });

    breaker.failure(new Error('failure'));

    // simulate cooldown expiry
    (Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 2000);

    breaker.success();

    const allowed = breaker.guard();

    expect(allowed).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      { name: 'test-breaker' },
      'Circuit breaker reset after successful call'
    );
  });
});
