import { render, screen } from '@testing-library/react';
import CryptoMoversCard from '@/components/TopMoversCard';
import { useTopMovers } from '@/hooks/useCryptoMovers';
import type { CryptoAsset } from '@/interfaces/crypto';

/**
 * Unit Test:
 * - Composition-level test (CryptoMoversCard)
 * - Data hook is mocked
 * - No socket or network logic exercised
 *
 * We test observable behavior only:
 * - Loading / connecting state when data is unavailable
 * - Column rendering when movers data exists
 * - Presence of gainers and losers content
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

jest.mock('@/hooks/useCryptoMovers');

describe('CryptoMoversCard (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders connecting state when movers data is not yet available', () => {
    (useTopMovers as jest.Mock).mockReturnValue(null);

    render(<CryptoMoversCard />);

    // Verifies loading / connecting UI
    expect(
      screen.getByText(/Connecting to crypto feed/i)
    ).toBeInTheDocument();
  });

  it('renders top gainers and top losers columns when movers data is available', () => {
    const mockCoin = (overrides: Partial<CryptoAsset> = {}): CryptoAsset => ({
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'btc',
      image: '/btc.png',
      marketCapRank: 1,
      currentPrice: 42000,
      priceChangePercentage1h: 1.23,
      totalVolume: 1_500_000_000,
      ...overrides,
    });

    (useTopMovers as jest.Mock).mockReturnValue({
      topGainers: {
        data: [mockCoin({ id: 'btc', symbol: 'btc' })],
      },
      topLosers: {
        data: [
          mockCoin({
            id: 'eth',
            name: 'Ethereum',
            symbol: 'eth',
            priceChangePercentage1h: -2.45,
          }),
        ],
      },
    });

    render(<CryptoMoversCard />);

    // Verifies column headers
    expect(screen.getByText(/Top Gainers/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Losers/i)).toBeInTheDocument();

    // Verifies gainers content (may appear multiple times due to responsive layout)
    expect(screen.getAllByText('BTC').length).toBeGreaterThan(0);

    // Verifies losers content
    expect(screen.getAllByText('ETH').length).toBeGreaterThan(0);
  });

  it('renders both columns even if one side has empty data', () => {
    (useTopMovers as jest.Mock).mockReturnValue({
      topGainers: { data: [] },
      topLosers: { data: [] },
    });

    render(<CryptoMoversCard />);

    // Structural integrity: columns still render
    expect(screen.getByText(/Top Gainers/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Losers/i)).toBeInTheDocument();
  });
});
