import { renderHook, waitFor } from '@testing-library/react';
import { useLocation } from './useLocation';
import { useInternet } from './useInternet';

// ---- Mock the dependency ----------------------------------------------------
jest.mock('./useInternet');
const mockUseInternet = useInternet as jest.MockedFunction<typeof useInternet>;

// ---- Shared fallback object (kept in one place) ----------------------------
const FALLBACK = {
  city: 'New Delhi',
  region: 'Delhi',
  country: 'India',
  lat: '28.6139',
  lon: '77.2090',
  ip: '0.0.0.0',
};

describe('useLocation – tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(); // reset fetch mock for each test
  });

  // --------------------------------------------------------------
  test('returns fallback when offline', () => {
    mockUseInternet.mockReturnValue(false);

    const { result } = renderHook(() => useLocation());

    expect(result.current).toEqual(FALLBACK);
  });

  // --------------------------------------------------------------
  test('fetches and returns location when online', async () => {
    mockUseInternet.mockReturnValue(true);

    const apiResponse = {
      city: 'Mumbai',
      region: 'Maharashtra',
      country: 'India',
      latitude: '19.0760',
      longitude: '72.8777',
      ip: '123.45.67.89',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(apiResponse),
    });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => expect(result.current?.city).toBe('Mumbai'));

    expect(global.fetch).toHaveBeenCalledWith('https://ipwho.is/');
    expect(result.current).toEqual({
      city: 'Mumbai',
      region: 'Maharashtra',
      country: 'India',
      lat: '19.0760',
      lon: '72.8777',
      ip: '123.45.67.89',
    });
  });

  // --------------------------------------------------------------
  test('falls back on fetch error', async () => {
    mockUseInternet.mockReturnValue(true);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLocation());

    await waitFor(() => expect(result.current?.city).toBe(FALLBACK.city));
    expect(result.current).toEqual(FALLBACK);
  });

  // --------------------------------------------------------------
  test('re‑fetches when online status changes', async () => {
    // 1️⃣ start offline → fallback
    mockUseInternet.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useLocation());

    expect(result.current?.city).toBe(FALLBACK.city);

    // 2️⃣ go online → mock a successful fetch
    mockUseInternet.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({
        city: 'Bangalore',
        region: 'Karnataka',
        country: 'India',
        latitude: '12.9716',
        longitude: '77.5946',
        ip: '987.65.43.21',
      }),
    });

    rerender(); // triggers the effect with the new `online` value

    await waitFor(() => expect(result.current?.city).toBe('Bangalore'));
    expect(result.current).toMatchObject({
      city: 'Bangalore',
      region: 'Karnataka',
      country: 'India',
    });
  });
});
