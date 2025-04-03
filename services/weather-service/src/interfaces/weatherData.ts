import { AirQuality } from "./weather";

export interface WeatherData {
    city: string;
    temperatureC: number;
    temperatureF: number;
    feelslikeC: number;
    condition: string;
    humidity: number;
    windMph: number;
    windKph: number;
    windDegree: number;
    windDir: string;
    icon: string;
    pressureMb: number;
    visibilityKm: number;
    airQuality: AirQuality;
    lastUpdated: string;
    fetchedAt: number;
}