import { renderHook, waitFor } from '@testing-library/react';
import { useInternet } from '@/hooks/useInternet';

/**
 * Unit Test:
 * We do NOT test:
 * - AbortController internals
 * - Timeout timing
 * - Browser networking
 */

describe('useInternet (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes state from navigator.onLine', () => {
    // Simulate browser offline state
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useInternet());

    // Initial state comes from browser hint
    expect(result.current).toBe(false);
  });

  it('sets online to true when HEAD request succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    // Mock successful HEAD request
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
    } as any);

    const { result } = renderHook(() => useInternet());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('sets online to false when fetch fails', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    // Simulate network / timeout / abort failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useInternet());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
