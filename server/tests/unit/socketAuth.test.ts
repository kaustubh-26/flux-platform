import jwt from 'jsonwebtoken';
import { socketAuthMiddleware, resolveClientIp, resolveGuestId } from '@/auth/socketAuth.middleware';
import { env } from '@/config/env';

describe('socketAuth.middleware (unit)', () => {
  const sampleUser = {
    userId: 'user_auth_777',
    sub: 'user_auth_777',
    provider: 'github',
    email: 'auth777@flux.local',
    name: 'Auth 777',
  };

  const createValidToken = () => jwt.sign(sampleUser, env.JWT_SECRET, { expiresIn: '1h' });

  let mockSocket: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockSocket = {
      id: 'socket-test-1',
      data: {},
      handshake: {
        address: '192.168.1.50',
        headers: {},
        auth: {},
      },
    };
    nextFn = jest.fn();
  });

  describe('resolveClientIp', () => {
    it('extracts first IP from x-forwarded-for header', () => {
      mockSocket.handshake.headers['x-forwarded-for'] = '203.0.113.195, 70.41.3.18';
      expect(resolveClientIp(mockSocket)).toBe('203.0.113.195');
    });

    it('falls back to socket handshake address when x-forwarded-for is absent', () => {
      expect(resolveClientIp(mockSocket)).toBe('192.168.1.50');
    });
  });

  describe('resolveGuestId', () => {
    it('uses handshake.auth.guestId when provided and valid', () => {
      mockSocket.handshake.auth.guestId = 'custom-guest-id-123';
      expect(resolveGuestId(mockSocket)).toBe('custom-guest-id-123');
    });

    it('generates a uuid when handshake.auth.guestId is missing or empty', () => {
      const generated = resolveGuestId(mockSocket);
      expect(typeof generated).toBe('string');
      expect(generated.length).toBeGreaterThan(10);
    });
  });

  describe('socketAuthMiddleware', () => {
    it('binds authenticated user identity when valid session cookie is present', () => {
      mockSocket.handshake.headers.cookie = `${env.COOKIE_NAME}=${createValidToken()}`;

      socketAuthMiddleware(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith();
      expect(mockSocket.data.user).toBeDefined();
      expect(mockSocket.data.user.type).toBe('authenticated');
      expect(mockSocket.data.user.id).toBe(sampleUser.userId);
      expect(mockSocket.data.user.user).toEqual(
        expect.objectContaining({
          userId: sampleUser.userId,
          email: sampleUser.email,
        })
      );
    });

    it('binds authenticated user identity when valid token is passed in handshake auth object', () => {
      mockSocket.handshake.auth.token = createValidToken();

      socketAuthMiddleware(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith();
      expect(mockSocket.data.user.type).toBe('authenticated');
      expect(mockSocket.data.user.id).toBe(sampleUser.userId);
    });

    it('preserves guest flow and assigns guest user when no auth token or cookie is present', () => {
      mockSocket.handshake.auth.guestId = 'guest-client-99';

      socketAuthMiddleware(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith();
      expect(mockSocket.data.user).toBeDefined();
      expect(mockSocket.data.user.type).toBe('guest');
      expect(mockSocket.data.user.id).toBe('guest-client-99');
    });

    it('preserves guest flow and falls back to guest identity when token is expired or invalid', () => {
      mockSocket.handshake.headers.cookie = `${env.COOKIE_NAME}=invalid.jwt.token`;
      mockSocket.handshake.auth.guestId = 'guest-client-fallback';

      socketAuthMiddleware(mockSocket, nextFn);

      // Must NOT error or reject connection
      expect(nextFn).toHaveBeenCalledWith();
      expect(mockSocket.data.user).toBeDefined();
      expect(mockSocket.data.user.type).toBe('guest');
      expect(mockSocket.data.user.id).toBe('guest-client-fallback');
    });
  });
});
