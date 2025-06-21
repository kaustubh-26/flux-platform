import { render, screen } from '@testing-library/react';
import WeatherCard from '@/components/WeatherCard';
import { useWeather } from '@/hooks/useWeather';
import type { WeatherData } from '@/interfaces/weather';

/**
 * Unit Test:
 * We test observable behavior only:
 * - Skeleton / loading state when no weather data exists
 * - Correct rendering of weather information when data is available
 * - Defensive numeric coercion (safe values)
 * - Presence (not uniqueness) of responsive content
 */

jest.mock('@/socket', () => ({
    getSocket: jest.fn(() => ({
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
    })),
    disconnectSocket: jest.fn(),
}));

jest.mock('@/socket/socketSingleton', () => ({
    getSocket: jest.fn(() => ({
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
    })),
    disconnectSocket: jest.fn(),
}));

jest.mock('@/hooks/useWeather');

describe('WeatherCard (unit)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockWeather = (
        overrides: Partial<WeatherData> = {}
    ): WeatherData => ({
        city: 'Mumbai',
        condition: 'clear sky',
        icon: '/icon.png',
        temperatureC: 32.4,
        feelslikeC: 35.1,
        humidity: 62,
        windKph: 14,
        visibilityKm: 10,
        airQuality: {
            pm25: 38,
        },
        lastUpdated: '2024-01-01T10:30:00Z',
        ...overrides,
    });

    it('renders skeleton state when no weather data is available', () => {
        (useWeather as jest.Mock).mockReturnValue({});

        render(<WeatherCard />);

        // No real weather content should be visible
        expect(
            screen.queryByText(/Weather/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/Mumbai/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/°/)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/Humidity/i)
        ).not.toBeInTheDocument();
    });

    it('renders weather data when at least one city is available', () => {
        (useWeather as jest.Mock).mockReturnValue({
            mumbai: mockWeather(),
        });

        render(<WeatherCard />);

        // Header
        expect(
            screen.getByText(/Weather/i)
        ).toBeInTheDocument();

        // City & condition (may appear twice due to responsive layout)
        expect(
            screen.getAllByText('Mumbai').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText(/clear sky/i).length
        ).toBeGreaterThan(0);

        // Temperature & feels-like
        expect(
            screen.getAllByText('32.4°').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText(/feels 35.1°/i).length
        ).toBeGreaterThan(0);
    });

    it('renders weather metrics correctly', () => {
        (useWeather as jest.Mock).mockReturnValue({
            mumbai: mockWeather(),
        });

        render(<WeatherCard />);

        // Metrics (assert presence, not uniqueness)
        expect(
            screen.getAllByText('62%').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('14 km/h').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('10 km').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('38').length
        ).toBeGreaterThan(0);
    });

    it('defensively renders numeric values when data contains invalid numbers', () => {
        (useWeather as jest.Mock).mockReturnValue({
            mumbai: mockWeather({
                temperatureC: undefined as any,
                feelslikeC: null as any,
                humidity: undefined as any,
                windKph: null as any,
                visibilityKm: undefined as any,
                airQuality: { pm25: null as any },
            }),
        });

        render(<WeatherCard />);

        // Safe numeric fallbacks render as zero
        expect(
            screen.getAllByText('0.0°').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText(/feels 0.0°/i).length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('0%').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('0 km/h').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('0 km').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('0').length
        ).toBeGreaterThan(0);
    });
});
