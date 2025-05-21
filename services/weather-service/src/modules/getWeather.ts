import axios from 'axios';
import https from 'https';
import { WeatherApiSchema } from '../schemas/weather.schema';
import fs from "fs";

export function resolveSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} is not set`);
  }
  // Docker secrets path
  if (value.startsWith("/run/secrets/")) {
    return fs.readFileSync(value, "utf8").trim();
  }
  // Local dev: literal value
  return value;
}


const WEATHER_API_KEY = process.env.WEATHER_API_KEY && !process.env.WEATHER_API_KEY.startsWith("/run/secrets/")
    ? process.env.WEATHER_API_KEY : resolveSecret("WEATHER_API_KEY");


const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

const axiosClient = axios.create({
  timeout: 10_000,
  httpsAgent,
});

export async function getWeatherFromApi(city: string) {
  const url = 'https://api.weatherapi.com/v1/forecast.json';

  const response = await axiosClient.get(url, {
    params: {
      q: city,
      days: 1,
      aqi: 'yes',
      alerts: 'yes',
      key: WEATHER_API_KEY,
    },
  });

  const parsed = WeatherApiSchema.safeParse(response.data);

  if (!parsed.success) {
    const error = new Error('Weather API schema mismatch');
    (error as any).issues = parsed.error.issues;
    throw error;
  }

  return parsed.data;
}
