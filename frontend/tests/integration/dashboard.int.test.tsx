/**
 * DashboardPage integration tests
 *
 * These tests cover the app bootstrap flow:
 * - waiting for user readiness
 * - socket + location handshake
 * - first-time vs returning user behavior
 *
 * We mock infra at the edges and exercise the real page logic.
 */

// mocks must be hoisted before imports

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

jest.mock('@/hooks/useLocation', () => ({
  useLocation: jest.fn(),
}));

jest.mock('@/utils', () => ({
  LocalStorage: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// debounce is timing-related noise for this test,
// so make it run synchronously
jest.mock('lodash.debounce', () => {
  return (fn: any) => {
    fn.cancel = jest.fn();
    return fn;
  };
});

// Child components are mocked since this test only
// cares about DashboardPage orchestration
jest.mock('@/components/Header', () => () => <div>Header</div>);
jest.mock('@/components/WeatherCard', () => () => <div>WeatherCard</div>);
jest.mock('@/components/NewsCard', () => () => <div>NewsCard</div>);
jest.mock('@/components/StockCard', () => () => <div>StockCard</div>);
jest.mock('@/components/CryptoCard', () => () => <div>CryptoCard</div>);

// ---- imports AFTER mocks ----

import { render, screen, act } from '@testing-library/react';
import DashboardPage from '@/pages/dashboard';
import { useSocket } from '@/context/socketContext';
import { useLocation } from '@/hooks/useLocation';
import { LocalStorage } from '@/utils';

describe('DashboardPage (integration)', () => {
  const emit = jest.fn();
  const on = jest.fn();
  const off = jest.fn();
  const setUserReady = jest.fn();

  const mockSocket = { emit, on, off };

  beforeEach(() => {
    jest.clearAllMocks();

    // Pretend we already know the user location
    (useLocation as jest.Mock).mockReturnValue({
      lat: 12.9,
      lon: 77.6,
    });

    // Socket is connected, but app has not
    // marked the user as ready yet
    (useSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      connected: true,
      userReady: false,
      setUserReady,
    });
  });

  // App should block rendering until user is ready
  it('shows loading screen while user is not ready', () => {
    render(<DashboardPage />);

    expect(
      screen.getByText(/Connecting to live data/i)
    ).toBeInTheDocument();

    // No dashboard content should be visible yet
    expect(screen.queryByText('Header')).not.toBeInTheDocument();
    expect(screen.queryByText('WeatherCard')).not.toBeInTheDocument();
    expect(screen.queryByText('StockCard')).not.toBeInTheDocument();
    expect(screen.queryByText('CryptoCard')).not.toBeInTheDocument();
  });

  // Returning user: userId already exists in storage
  it('uses stored userId, sends location, and marks user ready', () => {
    (LocalStorage.get as jest.Mock).mockReturnValue('stored-user-id');

    render(<DashboardPage />);

    // Location should be sent immediately
    expect(emit).toHaveBeenCalledWith(
      'userLocationUpdate',
      { lat: 12.9, lon: 77.6 },
      'stored-user-id'
    );

    // App moves past loading state
    expect(setUserReady).toHaveBeenCalledWith(true);
  });

  // First-time user: request id, then continue flow
  it('requests userId, stores it, sends location, and marks user ready', () => {
    (LocalStorage.get as jest.Mock).mockReturnValue(null);

    render(<DashboardPage />);

    // Ask backend for a new user id
    expect(emit).toHaveBeenCalledWith('getUserId');

    // Grab the registered socket handler
    const handler = on.mock.calls.find(
      ([event]) => event === 'userUniqueId'
    )?.[1];

    expect(handler).toBeDefined();

    // Simulate backend responding with a new id
    act(() => {
      handler('new-user-id');
    });

    // Persist the id locally
    expect(LocalStorage.set).toHaveBeenCalledWith(
      'userid',
      'new-user-id'
    );

    // Send initial location update
    expect(emit).toHaveBeenCalledWith(
      'userLocationUpdate',
      { lat: 12.9, lon: 77.6 },
      'new-user-id'
    );

    // App is now ready to render dashboard
    expect(setUserReady).toHaveBeenCalledWith(true);
  });
});
