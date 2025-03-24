export interface WeatherData {
    city: string,
    temperature_c: number,
    temperature_f: number,
    condition: string,
    humidity: number,
    wind_mph: number,
    wind_kph: number,
    wind_degree: number,
    wind_dir: string,
    icon: string,
    last_updated: string,
    timestamp: number
}