import { renderHook, waitFor } from '@testing-library/react';
import { useInternet } from './useInternet';

global.fetch = jest.fn();

describe('useInternet – tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  test('initial state follows navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    const { result } = renderHook(() => useInternet());
    expect(result.current).toBe(false);
  });

  test('sets online true on successful fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });
    const { result } = renderHook(() => useInternet());

    await waitFor(() => expect(result.current).toBe(true));
    expect(global.fetch).toHaveBeenCalled();
  });

  test('sets online false on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useInternet());

    await waitFor(() => expect(result.current).toBe(false));
    expect(global.fetch).toHaveBeenCalled();
  });

  test('checkInternet runs only once on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });
    const { rerender } = renderHook(() => useInternet());

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    rerender(); // simulate parent re‑render
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
