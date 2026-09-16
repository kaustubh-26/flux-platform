import jwt from 'jsonwebtoken';
import { requireAuth, optionalAuth } from '@/auth/auth.middleware';
import { env } from '@/config/env';

describe('auth.middleware (unit)', () => {
  const sampleUser = {
    userId: 'user_42',
    sub: 'user_42',
    provider: 'google',
    email: 'user42@gmail.com',
    name: 'User 42',
  };

  const createValidToken = () => jwt.sign(sampleUser, env.JWT_SECRET, { expiresIn: '1h' });

  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  describe('requireAuth', () => {
    it('returns 401 Unauthorized when no session token is provided', () => {
      requireAuth(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('no session token provided'),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('returns 401 Unauthorized when an invalid or expired token is provided', () => {
      mockReq.cookies = { [env.COOKIE_NAME]: 'invalid-token-signature' };

      requireAuth(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('Invalid or expired session token'),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('attaches req.user and calls next() when a valid token is provided via cookies', () => {
      mockReq.cookies = { [env.COOKIE_NAME]: createValidToken() };

      requireAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(sampleUser.userId);
      expect(mockReq.user.email).toBe(sampleUser.email);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('attaches req.user and calls next() when a valid token is provided via Authorization header', () => {
      mockReq.headers = { authorization: `Bearer ${createValidToken()}` };

      requireAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(sampleUser.userId);
    });
  });

  describe('optionalAuth', () => {
    it('resolves identity on req.user when valid token is present', () => {
      mockReq.cookies = { [env.COOKIE_NAME]: createValidToken() };

      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(sampleUser.userId);
    });

    it('proceeds without setting req.user when no token is present', () => {
      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('proceeds without setting req.user when token is invalid or expired', () => {
      mockReq.cookies = { [env.COOKIE_NAME]: 'corrupted-token' };

      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });
});
