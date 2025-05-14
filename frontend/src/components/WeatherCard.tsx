import { useMemo } from 'react';
import { useWeather } from '@/hooks/useWeather';
import type { WeatherData } from '@/interfaces/weather';

export default function WeatherCard() {
  const weatherByCity = useWeather();

  const weatherArray = useMemo(
    () =>
      Object.values(weatherByCity).filter(
        (v): v is WeatherData => Boolean(v)
      ),
    [weatherByCity]
  );

  if (weatherArray.length === 0) {
    return (
      <div className="w-full rounded-xl border border-slate-700/40 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-20 bg-slate-700/60 rounded animate-pulse" />
          <div className="h-3 w-14 bg-slate-700/50 rounded animate-pulse" />
        </div>

        {/* MOBILE SKELETON */}
        <div className="md:hidden space-y-4">
          {/* City + icon */}
          <div className="flex justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-slate-700/60 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-700/40 rounded animate-pulse" />
            </div>
            <div className="h-12 w-12 bg-slate-700/50 rounded-full animate-pulse" />
          </div>

          {/* Temperature */}
          <div className="flex items-end gap-3">
            <div className="h-14 w-24 bg-slate-700/60 rounded animate-pulse" />
            <div className="h-4 w-16 bg-slate-700/40 rounded animate-pulse mb-1" />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-full bg-slate-700/40 rounded animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* DESKTOP SKELETON */}
        <div className="hidden md:flex items-center gap-6">
          <div className="space-y-2 min-w-[140px]">
            <div className="h-5 w-28 bg-slate-700/60 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-700/40 rounded animate-pulse" />
          </div>

          <div className="flex items-end gap-3 min-w-[140px]">
            <div className="h-14 w-24 bg-slate-700/60 rounded animate-pulse" />
            <div className="h-4 w-16 bg-slate-700/40 rounded animate-pulse mb-1" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 min-w-[280px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-full bg-slate-700/40 rounded animate-pulse"
              />
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 bg-slate-700/50 rounded-full animate-pulse" />
            <div className="h-3 w-12 bg-slate-700/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const data = weatherArray[0];

  const safe = {
    temperatureC: Number(data.temperatureC) || 0,
    feelslikeC: Number(data.feelslikeC) || 0,
    humidity: Number(data.humidity) || 0,
    windKph: Number(data.windKph) || 0,
    visibilityKm: Number(data.visibilityKm) || 0,
    airQuality: {
      pm25: Number(data.airQuality?.pm25) || 0,
    },
  };

  return (
    <div className="w-full rounded-xl border border-slate-700/40 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200">
          🌦 Weather
        </h2>
        <span className="text-xs text-emerald-400 font-mono">
          {new Date(data.lastUpdated).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })}
        </span>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-4">
        {/* City + Icon */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white">
              {data.city}
            </h3>
            <p className="text-slate-300 capitalize">
              {data.condition}
            </p>
          </div>
          <img
            src={data.icon}
            alt={data.condition}
            className="w-12 h-12"
          />
        </div>

        {/* Temperature */}
        <div className="flex items-end gap-3">
          <span className="text-5xl font-black text-white">
            {safe.temperatureC.toFixed(1)}°
          </span>
          <span className="text-sm text-slate-400 mb-1">
            feels {safe.feelslikeC.toFixed(1)}°
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
          <Metric label="💧 Humidity" value={`${safe.humidity}%`} />
          <Metric label="💨 Wind" value={`${safe.windKph} km/h`} />
          <Metric label="👁 Visibility" value={`${safe.visibilityKm} km`} />
          <Metric label="☁️ AQI" value={safe.airQuality.pm25} />
        </div>

        <span className="text-xs text-slate-400">
          Updated{' '}
          {new Date(data.lastUpdated).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex items-center gap-6">
        {/* City */}
        <div className="min-w-[140px]">
          <h3 className="text-xl font-bold text-white truncate">
            {data.city}
          </h3>
          <p className="text-slate-300 capitalize truncate">
            {data.condition}
          </p>
        </div>

        {/* Temperature */}
        <div className="flex items-end gap-3 min-w-[140px]">
          <span className="text-5xl font-black text-white">
            {safe.temperatureC.toFixed(1)}°
          </span>
          <span className="text-sm text-slate-400 mb-1">
            feels {safe.feelslikeC.toFixed(1)}°
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300 min-w-[280px]">
          <Metric label="💧 Humidity" value={`${safe.humidity}%`} />
          <Metric label="💨 Wind" value={`${safe.windKph} km/h`} />
          <Metric label="👁 Visibility" value={`${safe.visibilityKm} km`} />
          <Metric label="☁️ AQI" value={safe.airQuality.pm25} />
        </div>

        <div className="flex-1" />

        {/* Icon + Time */}
        <div className="flex flex-col items-center">
          <img
            src={data.icon}
            alt={data.condition}
            className="w-14 h-14"
          />
          <span className="text-xs text-slate-400 mt-1">
            {new Date(data.lastUpdated).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper
function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
