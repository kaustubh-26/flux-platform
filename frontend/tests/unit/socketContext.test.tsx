import { render, screen, act } from '@testing-library/react';
import { SocketProvider, useSocket } from '@/context/socketContext';
import {
  getSocket,
  registerCoreSocketEvents,
  unregisterCoreSocketEvents,
} from '@/socket';

/**
 * Unit Test:
 * We verify:
 * - socket initialization
 * - core event registration lifecycle
 * - connected / userReady state transitions
 * - cleanup on unmount
 */

jest.mock('@/socket', () => ({
  getSocket: jest.fn(),
  registerCoreSocketEvents: jest.fn(),
  unregisterCoreSocketEvents: jest.fn(),
}));

// Minimal fake socket with event registry
function createMockSocket() {
  const handlers: Record<string, Function[]> = {};

  return {
    on: jest.fn((event, cb) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(cb);
    }),
    off: jest.fn((event, cb) => {
      handlers[event] = (handlers[event] || []).filter(h => h !== cb);
    }),
    emitEvent(event: string) {
      (handlers[event] || []).forEach(cb => cb());
    },
  } as any;
}

// Test consumer to read context values
function Consumer() {
  const { connected, userReady, setUserReady } = useSocket();
  return (
    <>
      <div data-testid="connected">{String(connected)}</div>
      <div data-testid="userReady">{String(userReady)}</div>
      <button onClick={() => setUserReady(true)}>ready</button>
    </>
  );
}

describe('SocketProvider (unit)', () => {
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    socket = createMockSocket();
    (getSocket as jest.Mock).mockReturnValue(socket);
  });

  it('initializes socket and registers core events on mount', () => {
    render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>
    );

    expect(getSocket).toHaveBeenCalled();
    expect(registerCoreSocketEvents).toHaveBeenCalledWith(socket);
  });

  it('sets connected=true on socket connect', () => {
    render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>
    );

    act(() => {
      socket.emitEvent('connect');
    });

    expect(screen.getByTestId('connected').textContent).toBe('true');
  });

  it('sets connected=false and resets userReady on disconnect', () => {
    render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>
    );

    // Simulate ready state
    act(() => {
      screen.getByText('ready').click();
      socket.emitEvent('connect');
    });

    expect(screen.getByTestId('userReady').textContent).toBe('true');

    act(() => {
      socket.emitEvent('disconnect');
    });

    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('userReady').textContent).toBe('false');
  });

  it('cleans up listeners and unregisters core events on unmount', () => {
    const { unmount } = render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>
    );

    unmount();

    expect(unregisterCoreSocketEvents).toHaveBeenCalledWith(socket);
    expect(socket.off).toHaveBeenCalled();
  });
});
