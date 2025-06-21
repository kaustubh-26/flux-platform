import { render, screen, fireEvent } from '@testing-library/react';
import CryptoCard from '@/components/CryptoCard';

/**
 * Unit Test Strategy:
 *
 * - Tests local UI state only (tab switching)
 * - Child components are mocked to avoid duplication
 * - No hooks, sockets, or integration behavior
 *
 * We verify:
 * - Default tab selection
 * - Correct conditional rendering on tab click
 */

// Mock child components to isolate CryptoCard behavior
jest.mock('@/components/TopMoversCard', () => () => (
  <div data-testid="movers-card">Movers</div>
));

jest.mock('@/components/CryptoTickerCard', () => () => (
  <div data-testid="ticker-card">Ticker</div>
));

describe('CryptoCard (unit)', () => {
  it('shows movers tab by default and switches to ticker on click', () => {
    render(<CryptoCard />);

    // Default state: movers tab is active
    expect(screen.getByTestId('movers-card')).toBeInTheDocument();
    expect(screen.queryByTestId('ticker-card')).toBeNull();

    // Switch to ticker tab
    fireEvent.click(screen.getByText('Live Ticker'));

    expect(screen.getByTestId('ticker-card')).toBeInTheDocument();
    expect(screen.queryByTestId('movers-card')).toBeNull();

    // Switch back to movers
    fireEvent.click(screen.getByText('📈 Crypto Movers'));

    expect(screen.getByTestId('movers-card')).toBeInTheDocument();
    expect(screen.queryByTestId('ticker-card')).toBeNull();
  });
});
