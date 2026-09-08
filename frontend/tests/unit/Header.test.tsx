import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Header from '@/components/Header';
import { AuthProvider } from '@/context/authContext';

jest.mock('@/assets/logo.png', () => 'logo.png');

describe('Header (unit)', () => {
  let fetchMock: jest.Mock;
  let assignMock: jest.Mock;
  const originalLocation = window.location;

  beforeEach(() => {
    fetchMock = jest.fn();
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    assignMock = jest.fn();
    delete (window as Window & { location?: Location }).location;
    window.location = {
      ...originalLocation,
      assign: assignMock,
    } as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  const renderHeader = () =>
    render(
      <AuthProvider>
        <Header />
      </AuthProvider>
    );

  it('shows only login when the session is not authenticated', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    renderHeader();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/auth/me', {
        credentials: 'include',
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i })
    );

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('shows only logout when the session is authenticated and logs out correctly', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: true,
          user: {
            sub: 'google_123',
            userId: 'google_123',
            provider: 'google',
            email: 'user@example.com',
            name: 'Flux User',
            iat: 1,
            exp: 2,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

    renderHeader();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/auth/me', {
        credentials: 'include',
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i })
    );

    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/');
    });
  });

  it('keeps logout disabled text while the logout request is in progress', async () => {
    let resolveLogout: ((value: { ok: boolean; status: number }) => void) | undefined;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: true,
          user: {
            sub: 'google_123',
            userId: 'google_123',
            provider: 'google',
            email: 'user@example.com',
            name: 'Flux User',
            iat: 1,
            exp: 2,
          },
        }),
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLogout = resolve;
          })
      );

    renderHeader();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/auth/me', {
        credentials: 'include',
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(screen.getByRole('button', { name: 'Logging out...' })).toBeDisabled();

    resolveLogout?.({
      ok: true,
      status: 204,
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/');
    });
  });
});
