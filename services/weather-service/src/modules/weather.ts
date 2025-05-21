import { WeatherApiResponse, Hour } from '../interfaces/weather';
import { WeatherData } from '../interfaces/weatherData';
import { WeatherResult } from '../interfaces/weatherResult';
import { getCurrentHourForecast } from '../utils/currentData';
import { formatIST } from '../utils/time';

import { cacheAvailable, cacheGet, cacheSet } from '../cache';
import { logger } from '../logger';

import * as circuitBreaker from '../modules/circuitBreaker';
import { getWeatherFromApi } from '../modules/getWeather';

export class WeatherService {

  // Response mapping
  createResponse(city: string, data: WeatherApiResponse | Hour): WeatherData {
    const source = 'current' in data ? data.current : data;

    return {
      city,
      temperatureC: source.temp_c,
      temperatureF: source.temp_f,
      feelslikeC: source.feelslike_c,
      condition: source.condition.text,
      humidity: source.humidity,
      windMph: source.wind_mph,
      windKph: source.wind_kph,
      windDegree: source.wind_degree,
      windDir: source.wind_dir,
      icon: source.condition.icon,
      pressureMb: source.pressure_mb,
      visibilityKm: source.vis_km,
      airQuality: source.air_quality,
      lastUpdated:
        'current' in data
          ? data.current.last_updated
          : data.time,
      fetchedAt: Date.now(),
    };
  }

  // Public API
  async getData(city: string): Promise<WeatherResult> {
    const timestamp = Date.now();
    const cacheKey = `weather:${city}`;

    // Cache-first (best effort)
    if (cacheAvailable()) {
      try {
        const cached = await cacheGet(cacheKey);

        if (cached) {
          const hourData = getCurrentHourForecast(cached);

          logger.info({ city }, 'Weather cache hit');

          return {
            status: 'success',
            source: 'cache',
            data: this.createResponse(city, hourData),
            timestamp,
          };
        }
      } catch (err) {
        logger.warn({ err }, 'Cache read failed, falling back to API');
      }
    }

    // API fallback
    return this.fetchFromApi(cacheKey, city, timestamp);
  }

  // Internal API fetch logic
  private async fetchFromApi(
    cacheKey: string,
    city: string,
    timestamp: number
  ): Promise<WeatherResult> {

    // Circuit breaker guard
    if (!circuitBreaker.canCall()) {
      logger.warn(
        { openUntil: formatIST(circuitBreaker.__getBreakerState().breakerOpenUntil) },
        'Circuit breaker open, skipping WeatherAPI call'
      );

      return {
        status: 'unavailable',
        reason: 'circuit_open',
        timestamp,
      };
    }

    try {
      // External API call
      const weather = await getWeatherFromApi(city);

      // Breaker success
      circuitBreaker.recordSuccess();

      // Cache write (best effort)
      if (cacheAvailable()) {
        const ttlSeconds = 6 * 60 * 60; // 6 hours
        await cacheSet(cacheKey, JSON.stringify(weather), ttlSeconds);

        logger.debug(
          { city, ttlSeconds },
          'Weather cached successfully'
        );
      }

      return {
        status: 'success',
        source: 'api',
        data: this.createResponse(city, weather),
        timestamp,
      };

    } catch (err: any) {
      // Breaker failure
      circuitBreaker.recordFailure();

      logger.error(
        { message: err.message, code: err.code },
        'Weather API request failed'
      );

      const reason =
        err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
          ? 'timeout'
          : 'api_error';

      return {
        status: 'unavailable',
        reason,
        timestamp,
      };
    }
  }
}
