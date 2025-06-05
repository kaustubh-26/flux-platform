import { AxiosInstance } from 'axios';

// Mocks
jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const loadModule = async () => {
  jest.resetModules();
  return await import('@/modules/topPerformers');
};

const mockAxios = {
  get: jest.fn(),
} as unknown as AxiosInstance;

const validQuote = {
  c: 110,
  pc: 100,
  h: 115,
  l: 95,
  o: 102,
};

beforeEach(() => {
  jest.clearAllMocks();

  // Execute all internal delays synchronously
  jest.spyOn(global, 'setTimeout').mockImplementation(
    (cb: (...args: any[]) => void) => {
      cb();
      return 0 as any;
    }
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

// getTopPerformers
describe('getTopPerformers (unit)', () => {
  /**
   * Purpose:
   * Verifies core behavior:
   * - fetches quotes
   * - calculates performance
   * - sorts by changePercent
   * - returns top gainers and losers
   */
  test('returns sorted top gainers and losers', async () => {
    mockAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { ...validQuote, c: 120 } }) // +20%
      .mockResolvedValueOnce({ data: { ...validQuote, c: 90 } })  // -10%
      .mockResolvedValue({ data: validQuote });

    const { getTopPerformers } = await loadModule();

    const result = await getTopPerformers({
      apiKey: 'test',
      axiosClient: mockAxios,
      limit: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.topGainers).toHaveLength(1);
    expect(result!.topLosers).toHaveLength(1);

    expect(result!.topGainers[0].changePercent).toBeGreaterThan(0);
    expect(result!.topLosers[0].changePercent).toBeLessThan(0);
  });

  /**
   * Purpose:
   * Verifies defensive behavior:
   * - invalid quote data is ignored
   * - calculation runs only on valid quotes
   */
  test('ignores invalid quotes from API', async () => {
    mockAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { ...validQuote, c: -1 } }) // invalid
      .mockResolvedValueOnce({ data: validQuote });

    const { getTopPerformers } = await loadModule();

    const result = await getTopPerformers({
      apiKey: 'test',
      axiosClient: mockAxios,
      limit: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.topGainers).toHaveLength(1);
    expect(result!.topLosers).toHaveLength(1);
  });

  /**
   * Purpose:
   * Verifies concurrency guard:
   * - second call while fetch is in progress is skipped
   */
  test('skips execution when fetch already in progress', async () => {
    mockAxios.get = jest.fn().mockResolvedValue({ data: validQuote });

    const { getTopPerformers } = await loadModule();

    const first = getTopPerformers({
      apiKey: 'test',
      axiosClient: mockAxios,
    });

    const second = getTopPerformers({
      apiKey: 'test',
      axiosClient: mockAxios,
    });

    const firstResult = await first;
    const secondResult = await second;

    expect(firstResult).not.toBeNull();
    expect(secondResult).toBeNull();
  });

  /**
   * Purpose:
   * Verifies sorting flexibility:
   * - supports alternative sort key (currentPrice)
   */
  test('sorts by custom metric when provided', async () => {
    mockAxios.get = jest.fn()
      .mockResolvedValueOnce({ data: { ...validQuote, c: 150 } })
      .mockResolvedValueOnce({ data: { ...validQuote, c: 80 } });

    const { getTopPerformers } = await loadModule();

    const result = await getTopPerformers({
      apiKey: 'test',
      axiosClient: mockAxios,
      sortBy: 'currentPrice',
      limit: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.topGainers[0].currentPrice).toBe(150);
  });
});
