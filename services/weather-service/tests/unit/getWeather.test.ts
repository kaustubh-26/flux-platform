// axios.create() executes at import time → must be mocked
jest.mock('axios');
jest.mock('@/schemas/weather.schema');

describe('getWeatherFromApi (unit)', () => {
  // Represents axiosClient.get() returned from axios.create()
  const mockGet = jest.fn();

  beforeEach(async () => {
    // Required when mocking import-time side effects
    jest.resetModules();
    jest.clearAllMocks();

    process.env.WEATHER_API_KEY = 'test-key';

    // Mock axios before importing the module under test
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: () => ({ get: mockGet }),
      },
    }));

    // Schema behavior is mocked; schema correctness is tested elsewhere
    jest.doMock('@/schemas/weather.schema', () => ({
      WeatherApiSchema: {
        safeParse: jest.fn(),
      },
    }));
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - API request succeeds
   * - schema validation passes
   * - parsed data is returned
   */
  it('returns parsed weather data when API response is valid', async () => {
    const { getWeatherFromApi } = await import('@/modules/getWeather');
    const { WeatherApiSchema } = await import('@/schemas/weather.schema');

    mockGet.mockResolvedValueOnce({ data: { raw: true } });
    (WeatherApiSchema.safeParse as jest.Mock).mockReturnValueOnce({
      success: true,
      data: { parsed: true },
    });

    const result = await getWeatherFromApi('Mumbai');

    expect(result).toEqual({ parsed: true });
    expect(mockGet).toHaveBeenCalled();
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - API succeeds
   * - schema validation fails
   * - error is surfaced to the caller
   */
  it('throws when Weather API schema validation fails', async () => {
    const { getWeatherFromApi } = await import('@/modules/getWeather');
    const { WeatherApiSchema } = await import('@/schemas/weather.schema');

    mockGet.mockResolvedValueOnce({ data: { invalid: true } });
    (WeatherApiSchema.safeParse as jest.Mock).mockReturnValueOnce({
      success: false,
      error: { issues: ['schema-error'] },
    });

    await expect(getWeatherFromApi('Delhi')).rejects.toThrow(
      'Weather API schema mismatch'
    );
  });

  /**
   * Purpose:
   * Verifies Error handling:
   * - transport-layer failures are propagated
   * - no silent swallowing or transformation
   */
  it('propagates axios errors', async () => {
    const { getWeatherFromApi } = await import('@/modules/getWeather');

    mockGet.mockRejectedValueOnce(new Error('Network failure'));

    await expect(getWeatherFromApi('Pune')).rejects.toThrow('Network failure');
  });
});