import { render, screen } from '@testing-library/react';
import NewsCard from '@/components/NewsCard';
import { useTopNews } from '@/hooks/useTopNews';

/**
 * Unit Test:
 * We verify:
 * - Skeleton loader when news is not available
 * - Rendering of valid news articles
 * - Filtering of articles without description
 */

jest.mock('@/hooks/useTopNews');
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

const mockArticles = [
  {
    id: '1',
    title: 'Bitcoin hits new high',
    description: 'BTC crosses a new milestone',
    source: 'CryptoTimes',
    url: 'https://example.com/1',
    publishedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Empty description article',
    description: '',
    source: 'Noise',
    url: 'https://example.com/2',
    publishedAt: new Date().toISOString(),
  },
];

describe('NewsCard (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows skeleton loader when news is not yet available', () => {
    (useTopNews as jest.Mock).mockReturnValue(null);

    render(<NewsCard />);

    // Loader text is not explicit, so we assert on known header
    expect(screen.getByText('Global News')).toBeInTheDocument();

    // Skeleton blocks should exist
    expect(
      document.querySelectorAll('.animate-pulse').length
    ).toBeGreaterThan(0);
  });

  it('renders only articles with valid descriptions', () => {
    (useTopNews as jest.Mock).mockReturnValue(mockArticles);

    render(<NewsCard />);

    // Valid article is rendered
    expect(
      screen.getByText('Bitcoin hits new high')
    ).toBeInTheDocument();

    // Article with empty description is filtered out
    expect(
      screen.queryByText('Empty description article')
    ).toBeNull();
  });

  it('renders article metadata when news is available', () => {
    (useTopNews as jest.Mock).mockReturnValue([mockArticles[0]]);

    render(<NewsCard />);

    expect(screen.getByText('Bitcoin hits new high')).toBeInTheDocument();
    expect(screen.getByText('CryptoTimes')).toBeInTheDocument();
  });
});
