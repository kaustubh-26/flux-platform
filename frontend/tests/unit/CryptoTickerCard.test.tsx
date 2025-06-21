import { render, screen } from '@testing-library/react';
import LiveTickerCard from '@/components/CryptoTickerCard';
import type { TopCoin } from '@/interfaces/crypto';

/**
 * Unit Test:
 * We verify:
 * - Loader state when top coins are missing
 * - Correct rendering when data is available
 * - Graceful placeholder rendering when ticker data is missing
 */

// --------------------
// Mocks
// --------------------
jest.mock('@/hooks/useCryptoTopCoins');
jest.mock('@/hooks/useCryptoTicker');
jest.mock('@/hooks/usePriceDelta');

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

// --------------------
// Hook imports (after mocks)
// --------------------
import { useCryptoTopCoins } from '@/hooks/useCryptoTopCoins';
import { useCryptoTickers } from '@/hooks/useCryptoTicker';
import { usePriceDelta } from '@/hooks/usePriceDelta';

// --------------------
// Test data
// --------------------
const mockTopCoins: TopCoin[] = [
  { name: 'Bitcoin', symbol: 'BTC' } as TopCoin,
  { name: 'Ethereum', symbol: 'ETH' } as TopCoin,
];

// --------------------
// Tests
// --------------------
describe('LiveTickerCard (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state when top coins are not available', () => {
    (useCryptoTopCoins as jest.Mock).mockReturnValue(null);
    (useCryptoTickers as jest.Mock).mockReturnValue({});

    render(<LiveTickerCard />);

    expect(
      screen.getByText('Connecting to live prices…')
    ).toBeInTheDocument();
  });

  it('renders rows when top coins data is available', () => {
    (useCryptoTopCoins as jest.Mock).mockReturnValue(mockTopCoins);
    (useCryptoTickers as jest.Mock).mockReturnValue({
      BTC: { price: '50000' },
      ETH: { price: '3000' },
    });
    (usePriceDelta as jest.Mock).mockReturnValue({
      direction: null,
      flash: null,
    });

    render(<LiveTickerCard />);

    /**
     * Coin names appear multiple times because
     * mobile + desktop layouts are rendered together.
     * Using getAllByText is the correct RTL approach.
     */
    expect(screen.getAllByText('Bitcoin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ethereum').length).toBeGreaterThan(0);
  });

  it('renders placeholder when ticker data is missing', () => {
    (useCryptoTopCoins as jest.Mock).mockReturnValue(mockTopCoins);
    (useCryptoTickers as jest.Mock).mockReturnValue({});
    (usePriceDelta as jest.Mock).mockReturnValue({
      direction: null,
      flash: null,
    });

    render(<LiveTickerCard />);

    // Placeholder symbol shown for missing price data
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
