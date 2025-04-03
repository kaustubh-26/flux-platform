export function getCurrentHourForecast(weatherData: any) {
  const forecastDay = weatherData?.forecast?.forecastday?.[0];
  if (!forecastDay?.hour?.length) return null;

  // Use WeatherAPI-provided local time (timezone-safe)
  const localTime = weatherData.location.localtime;

  // Extract hour safely
  const hour = Number(localTime.split(" ")[1].split(":")[0]);

  // Clamp defensively (just in case)
  const index = Math.min(Math.max(hour, 0), 23);

  return forecastDay.hour[index] ?? null;
}
