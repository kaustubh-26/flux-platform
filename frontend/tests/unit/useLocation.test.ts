import { renderHook, waitFor } from '@testing-library/react';
import { useLocation } from '@/hooks/useLocation';
import { useInternet } from '@/hooks/useInternet';

/**
 * Unit Test:
 * We validate:
 * - offline fallback
 * - successful online fetch
 * - graceful fallback on fetch failure
 *
 */

jest.mock('@/hooks/useInternet', () => ({
  useInternet: jest.fn(),
}));

describe('useLocation (unit)', () => {
  const fallbackLocation = {
    city: 'New Delhi',
    region: 'Delhi',
    country: 'India',
    lat: '28.6139',
    lon: '77.2090',
    ip: '0.0.0.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns fallback location immediately when offline', () => {
    // Internet is unavailable
    (useInternet as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useLocation());

    // Hook degrades gracefully without attempting fetch
    expect(result.current).toEqual(fallbackLocation);
  });

  it('fetches and sets location when online', async () => {
    (useInternet as jest.Mock).mockReturnValue(true);

    // Mock successful API response
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        city: 'Mumbai',
        region: 'Maharashtra',
        country: 'India',
        latitude: '19.0760',
        longitude: '72.8777',
        ip: '123.123.123.123',
      }),
    } as any);

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current).toEqual({
        city: 'Mumbai',
        region: 'Maharashtra',
        country: 'India',
        lat: '19.0760',
        lon: '72.8777',
        ip: '123.123.123.123',
      });
    });
  });

  it('falls back to default location when fetch fails', async () => {
    (useInternet as jest.Mock).mockReturnValue(true);

    // Simulate network / API failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current).toEqual(fallbackLocation);
    });
  });
});
