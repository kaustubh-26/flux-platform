import { WeatherService } from '@/modules/weather';

import { cacheAvailable, cacheGet, cacheSet } from '@/cache';
import { getCurrentHourForecast } from '@/utils/currentData';
import { getWeatherFromApi } from '@/modules/getWeather';
import * as circuitBreaker from '@/modules/circuitBreaker';

// Mocks
jest.mock('@/cache', () => ({
  cacheAvailable: jest.fn(),
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('@/utils/currentData', () => ({
  getCurrentHourForecast: jest.fn(),
}));

jest.mock('@/modules/getWeather', () => ({
  getWeatherFromApi: jest.fn(),
}));

jest.mock('@/modules/circuitBreaker', () => ({
  canCall: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  __getBreakerState: jest.fn(),
}));

describe('WeatherService (unit)', () => {
  let service: WeatherService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WeatherService();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - cache is available
   * - cached data exists
   * - response is returned from cache
   */
  it('returns weather data from cache when available', async () => {
    (cacheAvailable as jest.Mock).mockReturnValue(true);
    (cacheGet as jest.Mock).mockResolvedValue({ cached: true });

    (getCurrentHourForecast as jest.Mock).mockReturnValue({
      temp_c: 25,
      temp_f: 77,
      feelslike_c: 26,
      condition: { text: 'Clear', icon: 'icon' },
      humidity: 50,
      wind_mph: 5,
      wind_kph: 8,
      wind_degree: 90,
      wind_dir: 'E',
      pressure_mb: 1012,
      vis_km: 10,
      air_quality: {},
      time: '2025-01-01 10:00',
    });

    const result = await service.getData('Mumbai');

    expect(result.status).toBe('success');

    if (result.status === 'success') {
      expect(result.source).toBe('cache');
    }

    expect(cacheGet).toHaveBeenCalled();
    expect(getWeatherFromApi).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - cache read throws
   * - API fallback is used
   */
  it('falls back to API when cache read fails', async () => {
    (cacheAvailable as jest.Mock).mockReturnValue(true);
    (cacheGet as jest.Mock).mockRejectedValue(new Error('cache down'));
    (circuitBreaker.canCall as jest.Mock).mockReturnValue(true);

    (getWeatherFromApi as jest.Mock).mockResolvedValue({
      current: {
        temp_c: 30,
        temp_f: 86,
        feelslike_c: 32,
        condition: { text: 'Sunny', icon: 'icon' },
        humidity: 40,
        wind_mph: 4,
        wind_kph: 6,
        wind_degree: 100,
        wind_dir: 'E',
        pressure_mb: 1010,
        vis_km: 10,
        air_quality: {},
        last_updated: 'now',
      },
    });

    const result = await service.getData('Delhi');

    expect(result.status).toBe('success');

    if (result.status === 'success') {
      expect(result.source).toBe('api');
    }

    expect(getWeatherFromApi).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - circuit breaker is open
   * - API is not called
   * - unavailable response is returned
   */
  it('returns unavailable when circuit breaker is open', async () => {
    (cacheAvailable as jest.Mock).mockReturnValue(false);
    (circuitBreaker.canCall as jest.Mock).mockReturnValue(false);
    (circuitBreaker.__getBreakerState as jest.Mock).mockReturnValue({
      breakerOpenUntil: Date.now(),
    });

    const result = await service.getData('Pune');

    expect(result.status).toBe('unavailable');

    if (result.status === 'unavailable') {
      expect(result.reason).toBe('circuit_open');
    }

    expect(getWeatherFromApi).not.toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - API call succeeds
   * - breaker success is recorded
   * - cache is written
   */
  it('fetches from API, records success, and caches result', async () => {
    (cacheAvailable as jest.Mock).mockReturnValue(true);
    (cacheGet as jest.Mock).mockResolvedValue(null);
    (circuitBreaker.canCall as jest.Mock).mockReturnValue(true);

    (getWeatherFromApi as jest.Mock).mockResolvedValue({
      current: {
        temp_c: 28,
        temp_f: 82,
        feelslike_c: 29,
        condition: { text: 'Cloudy', icon: 'icon' },
        humidity: 60,
        wind_mph: 3,
        wind_kph: 5,
        wind_degree: 80,
        wind_dir: 'NE',
        pressure_mb: 1008,
        vis_km: 10,
        air_quality: {},
        last_updated: 'now',
      },
    });

    const result = await service.getData('Bangalore');

    expect(result.status).toBe('success');

    if (result.status === 'success') {
      expect(result.source).toBe('api');
    }

    expect(circuitBreaker.recordSuccess).toHaveBeenCalled();
    expect(cacheSet).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Error handling:
   * - API call fails
   * - breaker failure is recorded
   * - unavailable response is returned
   */
  it('records failure and returns unavailable when API call fails', async () => {
    (cacheAvailable as jest.Mock).mockReturnValue(false);
    (circuitBreaker.canCall as jest.Mock).mockReturnValue(true);

    (getWeatherFromApi as jest.Mock).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    );

    const result = await service.getData('Chennai');

    expect(result.status).toBe('unavailable');

    if (result.status === 'unavailable') {
      expect(result.reason).toBe('timeout');
    }

    expect(circuitBreaker.recordFailure).toHaveBeenCalled();
  });
});