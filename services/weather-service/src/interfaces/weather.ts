import { z } from "zod";
import {
  WeatherApiSchema,
  HourSchema,
  ConditionSchema,
  AirQualitySchema,
} from "../schemas/weather.schema";

/* ------------------ Root Types ------------------ */

export type WeatherApiResponse = z.infer<typeof WeatherApiSchema>;

/* ------------------ Reusable Types ------------------ */

export type Condition = z.infer<typeof ConditionSchema>;
export type AirQuality = z.infer<typeof AirQualitySchema>;
export type Hour = z.infer<typeof HourSchema>;
