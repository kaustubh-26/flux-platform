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
      <div className="h-full w-full rounded-xl border border-slate-700/40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <span className="text-slate-400 text-sm animate-pulse">
          Connecting to weather service…
        </span>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl border border-slate-700/40 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
      <div className="h-full flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200">
            🌦 Weather
          </h2>
          <span className="text-xs text-emerald-400 font-mono">LIVE</span>
        </div>

        {/* Content */}
        {weatherArray.length === 1 ? (
          <SingleWeatherHorizontal data={weatherArray[0]} />
        ) : (
          <WeatherGrid data={weatherArray.slice(0, 6)} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SINGLE CITY – HORIZONTAL LAYOUT WITH LABELED METRICS
   ============================================================ */

function SingleWeatherHorizontal({ data }: { data: WeatherData }) {
  const safeData = {
    ...data,
    temperatureC: Number(data.temperatureC) || 0,
    feelslikeC: Number(data.feelslikeC) || 0,
    humidity: Number(data.humidity) || 0,
    windKph: Number(data.windKph) || 0,
    visibilityKm: Number(data.visibilityKm) || 0,
    airQuality: {
      pm25: Number(data.airQuality?.pm25) || 0,
      usEpaIndex: Number(data.airQuality?.usEpaIndex) || 0,
    },
  };

  const { pm25, usEpaIndex } = safeData.airQuality;
  
  const getAQIColor = (index: number): string => {
    const colors = [
      'text-green-400', 'text-green-300',
      'text-yellow-400', 'text-orange-400',
      'text-red-400', 'text-purple-500'
    ];
    return colors[index] || 'text-gray-400';
  };

  return (
    <div className="flex flex-1 items-center gap-6 overflow-hidden">
      {/* City + Condition */}
      <div className="min-w-[140px]">
        <h3 className="text-xl font-bold text-white truncate">
          {data.city}
        </h3>
        <p className="text-slate-300 capitalize truncate">
          {data.condition}
        </p>
      </div>

      {/* Temperature */}
      <div className="flex items-end space-x-3 min-w-[140px]">
        <span className="text-5xl font-black text-white leading-none">
          {safeData.temperatureC.toFixed(1)}°
        </span>
        <span className="text-slate-400 text-sm mb-1">
          feels {safeData.feelslikeC.toFixed(1)}°
        </span>
      </div>

      {/* Metrics + AQI with labels */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300 min-w-[280px]">
        <div className="flex items-center space-x-1">
          <span>💧</span>
          <span className="font-mono">Humidity {safeData.humidity}%</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>💨</span>
          <span className="font-mono">Wind {safeData.windKph.toFixed(0)} km/h</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>👁</span>
          <span className="font-mono">Vis. {safeData.visibilityKm} km</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className={`☁️ ${getAQIColor(usEpaIndex)}`}></span>
          <span className={`font-mono ${getAQIColor(usEpaIndex)}`}>AQI {pm25.toFixed(0)}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Icon + Time */}
      <div className="flex flex-col items-center flex-shrink-0">
        <img
          src={data.icon}
          alt={data.condition}
          className="w-14 h-14 drop-shadow-xl"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              '/default-weather.svg';
          }}
        />
        <span className="text-xs text-slate-400 mt-1 whitespace-nowrap">
          {new Date(data.lastUpdated).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   MULTI CITY GRID WITH LABELED METRICS
   ============================================================ */

function WeatherGrid({ data }: { data: WeatherData[] }) {
  return (
    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {data.map((city) => (
        <MiniWeatherCard
          key={`${city.city}-${city.fetchedAt}`}
          data={city}
        />
      ))}
    </div>
  );
}

function MiniWeatherCard({ data }: { data: WeatherData }) {
  const safeData = {
    temperatureC: Number(data.temperatureC) || 0,
    humidity: Number(data.humidity) || 0,
    windKph: Number(data.windKph) || 0,
    airQuality: {
      pm25: Number(data.airQuality?.pm25) || 0,
      usEpaIndex: Number(data.airQuality?.usEpaIndex) || 0,
    },
  };

  const { pm25, usEpaIndex } = safeData.airQuality;
  
  const getAQIColor = (index: number): string => {
    const colors = [
      'text-green-400', 'text-green-300',
      'text-yellow-400', 'text-orange-400',
      'text-red-400', 'text-purple-500'
    ];
    return colors[index] || 'text-gray-400';
  };

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3 flex flex-col justify-between h-full">
      <div className="flex justify-between items-start">
        <h4 className="text-sm font-semibold text-white truncate max-w-[60%]">
          {data.city}
        </h4>
        <img
          src={data.icon}
          alt={data.condition}
          className="w-8 h-8 flex-shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/default-weather.svg';
          }}
        />
      </div>

      <div className="mt-2">
        <span className="text-2xl font-bold text-white leading-none">
          {safeData.temperatureC.toFixed(0)}°
        </span>
        <p className="text-xs text-slate-400 capitalize truncate">
          {data.condition}
        </p>
      </div>

      <div className="mt-2 space-y-1 text-[10px] text-slate-400">
        <div className="flex items-center justify-between">
          <span>💧 Hum.</span>
          <span className="font-mono">{safeData.humidity}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`☁️ ${getAQIColor(usEpaIndex)}`}>AQI</span>
          <span className={`font-mono ${getAQIColor(usEpaIndex)}`}>{pm25.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
