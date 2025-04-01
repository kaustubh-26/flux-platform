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

export interface WeatherPayload {
  status: string;
  source: string;
  data: WeatherData;
  timestamp: number;
}

export interface AirQuality {
  pm25: number;
  usEpaIndex: number;
}
