export interface WeatherData {
    city: string,
    temperatureC: number,
    temperatureF: number,
    condition: string,
    humidity: number,
    windMph: number,
    windKph: number,
    windDegree: number,
    windDir: string,
    icon: string,
    lastUpdated: string,
    fetchedAt: number
}