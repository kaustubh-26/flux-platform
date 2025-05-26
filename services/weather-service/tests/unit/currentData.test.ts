import { getCurrentHourForecast } from '@/utils/currentData';

describe('getCurrentHourForecast (unit)', () => {
  /**
   * Purpose:
   * Verifies Core behavior:
   * - extracts local hour
   * - returns corresponding forecast hour
   */
  it('returns forecast for the current local hour', () => {
    const weatherData = {
      location: {
        localtime: '2025-01-01 14:30',
      },
      forecast: {
        forecastday: [
          {
            hour: Array.from({ length: 24 }, (_, i) => ({ hour: i })),
          },
        ],
      },
    };

    const result = getCurrentHourForecast(weatherData);

    expect(result).toEqual({ hour: 14 });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - missing forecast data
   * - returns null safely
   */
  it('returns null when forecast data is missing', () => {
    const result = getCurrentHourForecast({
      location: { localtime: '2025-01-01 10:00' },
    });

    expect(result).toBeNull();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - empty hour array
   * - returns null
   */
  it('returns null when hourly forecast is empty', () => {
    const result = getCurrentHourForecast({
      location: { localtime: '2025-01-01 10:00' },
      forecast: {
        forecastday: [{ hour: [] }],
      },
    });

    expect(result).toBeNull();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - hour is clamped to valid range
   */
  it('clamps hour index to valid range', () => {
    const weatherData = {
      location: {
        localtime: '2025-01-01 99:00', // invalid hour
      },
      forecast: {
        forecastday: [
          {
            hour: Array.from({ length: 24 }, (_, i) => ({ hour: i })),
          },
        ],
      },
    };

    const result = getCurrentHourForecast(weatherData);

    // 99 → clamped to 23
    expect(result).toEqual({ hour: 23 });
  });
});
