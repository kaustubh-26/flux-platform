import { WeatherData } from './weatherData';

export type WeatherResult =
    | {
        status: 'success';
        source: 'cache' | 'api';
        data: WeatherData;
        timestamp: number;
    }
    | {
        status: 'unavailable';
        reason: 'circuit_open' | 'timeout' | 'api_error';
        timestamp: number;
    };
