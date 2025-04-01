import { useEffect, useState } from 'react';
import { useSocket } from '@/context/socketContext';
import { WeatherData, WeatherPayload } from '@/interfaces/weather';

// Weather data (latest always)
export function useWeather() {
    const [weatherByCity, setWeatherByCity] = useState<Record<string, WeatherData>>({});
    const { socket } = useSocket();

    useEffect(() => {
        const handler = (event: string, payload: WeatherPayload) => {
            if (event.endsWith('.update') && event.startsWith('weather.')) {
                const city = event.split('.')[1];
                if (payload.status === 'success') {
                    // Update or add city data
                    setWeatherByCity(prev => ({
                        ...prev,
                        [city]: payload.data  // Overwrites with latest
                    }));
                }
            }
        };

        socket?.onAny(handler);
        return () => {
            void socket?.offAny(handler);  // ensure cleanup returns void
        };
    }, []);

    return weatherByCity;
}
