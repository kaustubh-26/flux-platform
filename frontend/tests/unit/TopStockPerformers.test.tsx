import { render, screen, fireEvent } from '@testing-library/react';
import TopStockPerformers from '@/components/TopStockPerformers';
import type { StockMover } from '@/interfaces/stocks';

/**
 * Unit Test:
 * - Component-level test (TopStockPerformers)
 * - No hooks, sockets, or network involved
 *
 * We test observable behavior only:
 * - Loading / connecting state when movers are null
 * - Column rendering for gainers and losers
 * - Row rendering with correct formatting
 * - Expand / collapse interaction on row click
 */

describe('TopStockPerformers (unit)', () => {
    const mockStock = (overrides: Partial<StockMover> = {}): StockMover => ({
        symbol: 'AAPL',
        currentPrice: 189.23,
        changePercent: 1.56,
        open: 187.5,
        high: 190.1,
        low: 186.9,
        previousClose: 187.8,
        ...overrides,
    });

    const mockMovers = {
        timestamp: '2024-01-01T10:15:00Z',
        topGainers: [
            mockStock({ symbol: 'AAPL', changePercent: 1.56 }),
        ],
        topLosers: [
            mockStock({
                symbol: 'TSLA',
                changePercent: -2.34,
                currentPrice: 245.67,
            }),
        ],
    };

    it('renders connecting state when movers are null', () => {
        render(<TopStockPerformers movers={null} />);

        // Verifies loading / connecting UI
        expect(
            screen.getByText(/Connecting to stock feed/i)
        ).toBeInTheDocument();
    });

    it('renders top gainers and top losers columns when movers data is available', () => {
        render(<TopStockPerformers movers={mockMovers} />);

        // Verifies column headers
        expect(screen.getByText(/Top Gainers/i)).toBeInTheDocument();
        expect(screen.getByText(/Top Losers/i)).toBeInTheDocument();

        // Verifies stock symbols appear (may appear multiple times due to responsive layout)
        expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
        expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);
    });

    it('renders formatted price and change percentage', () => {
        render(<TopStockPerformers movers={mockMovers} />);

        // Price formatting (may appear multiple times due to responsive layout)
        expect(
            screen.getAllByText('$189.23').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('$245.67').length
        ).toBeGreaterThan(0);

        // Percentage formatting with sign
        expect(
            screen.getAllByText('+1.56%').length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText('-2.34%').length
        ).toBeGreaterThan(0);
    });


    it('toggles expanded stock details when a row is clicked', () => {
        render(<TopStockPerformers movers={mockMovers} />);

        // Click the row (symbol text is a safe interaction target)
        fireEvent.click(screen.getAllByText('AAPL')[0]);

        // Expanded overlay content becomes visible
        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(screen.getByText('$187.50')).toBeInTheDocument();

        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('$190.10')).toBeInTheDocument();

        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('$186.90')).toBeInTheDocument();

        expect(screen.getByText('Prev Close')).toBeInTheDocument();
        expect(screen.getByText('$187.80')).toBeInTheDocument();

        // Timestamp rendering (only asserting presence, not exact time formatting)
        expect(
            screen.getByText(/Last updated:/i)
        ).toBeInTheDocument();

        // Clicking again collapses the overlay
        fireEvent.click(screen.getAllByText('AAPL')[0]);

        expect(
            screen.queryByText('Open')
        ).not.toBeInTheDocument();
    });

    it('renders empty columns gracefully when no movers exist', () => {
        render(
            <TopStockPerformers
                movers={{
                    timestamp: mockMovers.timestamp,
                    topGainers: [],
                    topLosers: [],
                }}
            />
        );

        // Columns still render
        expect(screen.getByText(/Top Gainers/i)).toBeInTheDocument();
        expect(screen.getByText(/Top Losers/i)).toBeInTheDocument();
    });
});
