import { render, screen } from '@testing-library/react';
import StockCard from '@/components/StockCard';
import { useStockTopPerformers } from '@/hooks/useStockTopPerformers';

/**
 * Unit Test:
 * We test observable behavior only:
 * - Tab label metadata rendering
 * - Conditional child rendering
 * - Defensive handling of null movers
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

jest.mock('@/hooks/useStockTopPerformers');

jest.mock('@/components/TopStockPerformers', () => ({
  __esModule: true,
  default: ({ movers }: any) => (
    <div data-testid="top-stock-performers">
      {movers ? 'has-data' : 'no-data'}
    </div>
  ),
}));

describe('StockCard (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tab metadata derived from stock top performers hook', () => {
    (useStockTopPerformers as jest.Mock).mockReturnValue({
      data: null,
      metaData: {
        market: 'US',
        exchanges: ['NYSE', 'NASDAQ'],
        currency: 'USD',
      },
    });

    render(<StockCard />);

    // Verifies composed tab label
    expect(
      screen.getByText(/Stock Top Performers - US Equities/i)
    ).toBeInTheDocument();

    // Verifies exchange formatting
    expect(
      screen.getByText(/NYSE \/ NASDAQ/i)
    ).toBeInTheDocument();

    // Verifies currency display
    expect(
      screen.getByText(/USD/i)
    ).toBeInTheDocument();
  });

  it('renders TopStockPerformers child when movers data is available', () => {
    (useStockTopPerformers as jest.Mock).mockReturnValue({
      data: [{ symbol: 'AAPL' }],
      metaData: {
        market: 'US',
        exchanges: ['NYSE'],
        currency: 'USD',
      },
    });

    render(<StockCard />);

    // Child component is rendered
    expect(
      screen.getByTestId('top-stock-performers')
    ).toBeInTheDocument();

    // Movers data is passed through
    expect(
      screen.getByText('has-data')
    ).toBeInTheDocument();
  });

  it('passes null movers defensively when data is unavailable', () => {
    (useStockTopPerformers as jest.Mock).mockReturnValue({
      data: null,
      metaData: {
        market: 'US',
        exchanges: ['NYSE'],
        currency: 'USD',
      },
    });

    render(<StockCard />);

    // Child still renders due to active tab
    expect(
      screen.getByTestId('top-stock-performers')
    ).toBeInTheDocument();

    // Defensive null handling
    expect(
      screen.getByText('no-data')
    ).toBeInTheDocument();
  });
});
