import { AxiosInstance } from 'axios';
import { newsLimiter } from '@/modules/newsLimiter';
import { cacheGet, cacheSet } from '@/cache';

jest.mock('@/cache');
jest.mock('@/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * Rate limiter stub:
 * - Executes scheduled function immediately
 * - Preserves behavior without timing complexity
 */
jest
  .spyOn(newsLimiter, 'schedule')
  .mockImplementation((fn: any) => fn());

const createAxiosClient = (): AxiosInstance =>
  ({
    get: jest.fn(),
  } as unknown as AxiosInstance);

/**
 * Schema-valid article factory
 * Only required fields are populated with realistic values
 */
const createValidArticle = (overrides: Partial<any> = {}) => ({
  article_id: 'id-1',
  link: 'https://example.com',

  title: 'Title',
  description: 'Description',
  content: null,

  keywords: [],
  creator: null,

  language: 'en',
  country: ['us'],
  category: ['business'],

  datatype: 'news',

  pubDate: '2024-01-01 10:00:00',
  pubDateTZ: 'UTC',
  fetched_at: '2024-01-01 10:00:00',

  image_url: null,
  video_url: null,

  source_id: 'src',
  source_name: 'Source',
  source_priority: 1,
  source_url: 'https://source.com',
  source_icon: 'https://source.com/icon.png',

  sentiment: null,
  sentiment_stats: null,

  ai_tag: null,
  ai_region: null,
  ai_org: null,
  ai_summary: null,

  duplicate: false,

  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getNews (unit)', () => {
  /**
   * Purpose:
   * Verifies cache fast-path behavior:
   * - Cached data is returned immediately
   * - Network call is skipped
   */
  test('returns cached news without invoking API', async () => {
    jest.isolateModules(async () => {
      const { getNews } = await import('@/modules/getNews');

      (cacheGet as jest.Mock).mockResolvedValue([
        { id: 'cached-id', title: 'Cached News' },
      ]);

      const axiosClient = createAxiosClient();

      const result = await getNews({
        apiKey: 'key',
        axiosClient,
      });

      expect(result.source).toBe('cache');
      expect(axiosClient.get).not.toHaveBeenCalled();
    });
  });

  /**
   * Purpose:
   * Verifies single-flight behavior:
   * - Concurrent requests are deduplicated
   * - Only one API request is executed
   */
  test('deduplicates concurrent requests using single-flight', async () => {
    jest.isolateModules(async () => {
      const { getNews } = await import('@/modules/getNews');

      (cacheGet as jest.Mock).mockResolvedValue(null);

      const axiosClient = createAxiosClient();

      (axiosClient.get as jest.Mock).mockResolvedValue({
        data: {
          status: 'success',
          totalResults: 1,
          results: [createValidArticle()],
        },
      });

      await Promise.all([
        getNews({ apiKey: 'key', axiosClient }),
        getNews({ apiKey: 'key', axiosClient }),
      ]);

      expect(axiosClient.get).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Purpose:
   * Verifies successful API fetch behavior:
   * - Schema validation passes
   * - Data is transformed correctly
   * - Result is cached
   */
  test('fetches news from API and caches the result', async () => {
    jest.isolateModules(async () => {
      const { getNews } = await import('@/modules/getNews');

      (cacheGet as jest.Mock).mockResolvedValue(null);

      const axiosClient = createAxiosClient();

      (axiosClient.get as jest.Mock).mockResolvedValue({
        data: {
          status: 'success',
          totalResults: 1,
          results: [
            createValidArticle({ article_id: '42' }),
          ],
        },
      });

      const result = await getNews({
        apiKey: 'key',
        axiosClient,
      });

      expect(result.source).toBe('api');
      expect(cacheSet).toHaveBeenCalled();
      expect(result.data[0].id).toBe('42');
    });
  });

  /**
   * Purpose:
   * Verifies defensive behavior on schema mismatch:
   * - Invalid API payload is rejected
   * - Invalid data is not cached
   */
  test('throws when News API response schema is invalid', async () => {
    jest.isolateModules(async () => {
      const { getNews } = await import('@/modules/getNews');

      (cacheGet as jest.Mock).mockResolvedValue(null);

      const axiosClient = createAxiosClient();

      (axiosClient.get as jest.Mock).mockResolvedValue({
        data: {
          status: 'success',
          totalResults: 1,
          results: [
            {
              // intentionally incomplete article
              datatype: 'news',
              title: 'Invalid',
            },
          ],
        },
      });

      await expect(
        getNews({ apiKey: 'key', axiosClient })
      ).rejects.toThrow('NEWS_SCHEMA_MISMATCH');

      expect(cacheSet).not.toHaveBeenCalled();
    });
  });

  /**
   * Purpose:
   * Verifies circuit breaker behavior:
   * - Breaker opens after repeated network failures
   * - Subsequent calls fail immediately
   */
  test('opens circuit breaker after repeated network failures', async () => {
    jest.isolateModules(async () => {
      const { getNews } = await import('@/modules/getNews');

      (cacheGet as jest.Mock).mockResolvedValue(null);

      const axiosClient = createAxiosClient();

      (axiosClient.get as jest.Mock).mockRejectedValue({
        code: 'ETIMEDOUT',
      });

      for (let i = 0; i < 3; i++) {
        await expect(
          getNews({ apiKey: 'key', axiosClient })
        ).rejects.toBeDefined();
      }

      await expect(
        getNews({ apiKey: 'key', axiosClient })
      ).rejects.toThrow('circuit breaker');

      expect(axiosClient.get).toHaveBeenCalledTimes(3);
    });
  });
});
