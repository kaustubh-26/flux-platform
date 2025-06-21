import { renderHook, act } from '@testing-library/react';
import { useWeather } from '@/hooks/useWeather';
import { useSocket } from '@/context/socketContext';

/**
 * Unit Test Strategy:
 *
 * - Socket context is fully mocked
 * - No real socket connection
 * - Tests validate observable behavior only
 *
 * We verify:
 * - onAny subscription
 * - event name parsing
 * - defensive payload handling
 * - overwrite behavior for latest updates
 * - cleanup on unmount
 */

jest.mock('@/context/socketContext', () => ({
  useSocket: jest.fn(),
}));

describe('useWeather (unit)', () => {
  const onAny = jest.fn();
  const offAny = jest.fn();

  const mockSocket = { onAny, offAny };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to socket onAny events', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    renderHook(() => useWeather());

    expect(onAny).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates weather state when valid weather update event is received', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useWeather());
    const handler = onAny.mock.calls[0][0];

    const payload = {
      status: 'success',
      data: { temperature: 30, condition: 'Sunny' },
    };

    act(() => {
      handler('weather.delhi.update', payload);
    });

    expect(result.current).toEqual({
      delhi: payload.data,
    });
  });

  it('overwrites city weather data with latest update', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useWeather());
    const handler = onAny.mock.calls[0][0];

    act(() => {
      handler('weather.delhi.update', {
        status: 'success',
        data: { temperature: 28 },
      });

      handler('weather.delhi.update', {
        status: 'success',
        data: { temperature: 31 },
      });
    });

    // Latest data overwrites previous entry
    expect(result.current).toEqual({
      delhi: { temperature: 31 },
    });
  });

  it('ignores events that are not weather update events', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { result } = renderHook(() => useWeather());
    const handler = onAny.mock.calls[0][0];

    act(() => {
      handler('stock.delhi.update', { status: 'success', data: {} });
      handler('weather.delhi.snapshot', { status: 'success', data: {} });
      handler('weather.delhi.update', { status: 'error', data: {} });
    });

    // Defensive behavior: no invalid state updates
    expect(result.current).toEqual({});
  });

  it('cleans up onAny listener on unmount', () => {
    (useSocket as jest.Mock).mockReturnValue({ socket: mockSocket });

    const { unmount } = renderHook(() => useWeather());

    unmount();

    expect(offAny).toHaveBeenCalledWith(expect.any(Function));
  });
});
