/**
 * Focus:
 * - Session verification in getCurrentUser
 * - Cookie clearing on logout
 * - OAuth callback handling, token issuance, and redirects
 * - Error handling and redirect on failure
 */

import type { Request, Response } from 'express';
import {
  getCurrentUser,
  handleOAuthCallback,
  logout,
} from '@/controllers/auth.controller';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
  verifySessionToken,
} from '@/services/jwt.service';
import { findOrCreateOAuthUser } from '@/services/user.service';
import { env } from '@/config/env';

jest.mock('@/services/jwt.service', () => ({
  clearSessionCookie: jest.fn(),
  setSessionCookie: jest.fn(),
  signSessionToken: jest.fn(),
  verifySessionToken: jest.fn(),
}));

jest.mock('@/services/user.service', () => ({
  findOrCreateOAuthUser: jest.fn(),
}));

jest.mock('@/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('auth.controller (unit)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      cookies: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
  });

  describe('getCurrentUser', () => {
    /**
     * Purpose:
     * Verifies Defensive behavior:
     * - Returns 401 when no session cookie is attached to the request
     */
    it('returns 401 authenticated false when session cookie is absent', async () => {
      mockReq.cookies = {};

      await getCurrentUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        authenticated: false,
        message: 'No active session',
      });
    });

    /**
     * Purpose:
     * Verifies Core behavior:
     * - Verifies valid session token and returns 200 with user payload
     */
    it('returns 200 with user payload when valid session token exists', async () => {
      const mockPayload = {
        sub: 'user_123',
        userId: 'user_123',
        provider: 'github' as const,
        email: 'alice@example.com',
        name: 'Alice',
      };

      mockReq.cookies = {
        [env.COOKIE_NAME]: 'valid-jwt-token',
      };
      (verifySessionToken as jest.Mock).mockReturnValueOnce(mockPayload);

      await getCurrentUser(mockReq as Request, mockRes as Response);

      expect(verifySessionToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        authenticated: true,
        user: mockPayload,
      });
    });

    /**
     * Purpose:
     * Verifies Defensive behavior:
     * - Returns 401 when token verification fails
     */
    it('returns 401 when session token is invalid or expired', async () => {
      mockReq.cookies = {
        [env.COOKIE_NAME]: 'corrupt-token',
      };
      (verifySessionToken as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      await getCurrentUser(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        authenticated: false,
        message: 'Invalid or expired session',
      });
    });
  });

  describe('logout', () => {
    /**
     * Purpose:
     * Verifies Core behavior:
     * - Clears session cookie and responds with 204 No Content
     */
    it('clears session cookie and returns 204 status', async () => {
      await logout(mockReq as Request, mockRes as Response);

      expect(clearSessionCookie).toHaveBeenCalledWith(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleOAuthCallback', () => {
    const validOAuthUser = {
      provider: 'google' as const,
      providerId: 'google-sub-777',
      email: 'bob@example.com',
      name: 'Bob Google',
      avatarUrl: 'https://avatar.url',
    };

    /**
     * Purpose:
     * Verifies Core behavior:
     * - Resolves user in MongoDB, issues JWT, sets session cookie, and redirects to success URL
     */
    it('handles successful OAuth callback and redirects to client success URL', async () => {
      mockReq.user = validOAuthUser;

      const persistedUser = {
        userId: 'google_google-sub-777',
        provider: 'google' as const,
        email: 'bob@example.com',
        name: 'Bob Google',
      };

      (findOrCreateOAuthUser as jest.Mock).mockResolvedValueOnce(persistedUser);
      (signSessionToken as jest.Mock).mockReturnValueOnce('signed-jwt-token');

      const handler = handleOAuthCallback('google');
      await handler(mockReq as Request, mockRes as Response);

      expect(findOrCreateOAuthUser).toHaveBeenCalledWith({
        provider: 'google',
        providerId: 'google-sub-777',
        email: 'bob@example.com',
        name: 'Bob Google',
        avatarUrl: 'https://avatar.url',
      });
      expect(signSessionToken).toHaveBeenCalledWith(persistedUser);
      expect(setSessionCookie).toHaveBeenCalledWith(mockRes, 'signed-jwt-token');
      expect(mockRes.redirect).toHaveBeenCalledWith(env.CLIENT_SUCCESS_REDIRECT);
    });

    /**
     * Purpose:
     * Verifies Defensive behavior:
     * - Redirects to failure redirect if req.user is absent
     */
    it('redirects to failure redirect when req.user is missing', async () => {
      mockReq.user = undefined;

      const handler = handleOAuthCallback('google');
      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(env.CLIENT_FAILURE_REDIRECT);
      expect(findOrCreateOAuthUser).not.toHaveBeenCalled();
    });

    /**
     * Purpose:
     * Verifies Defensive behavior:
     * - Redirects to failure redirect when callback provider does not match user provider
     */
    it('redirects to failure redirect when provider mismatches', async () => {
      mockReq.user = {
        ...validOAuthUser,
        provider: 'github' as const,
      };

      const handler = handleOAuthCallback('google');
      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(env.CLIENT_FAILURE_REDIRECT);
      expect(findOrCreateOAuthUser).not.toHaveBeenCalled();
    });

    /**
     * Purpose:
     * Verifies Error handling:
     * - Redirects to failure redirect when user persistence or token generation throws
     */
    it('catches exceptions during processing and redirects to failure redirect', async () => {
      mockReq.user = validOAuthUser;
      (findOrCreateOAuthUser as jest.Mock).mockRejectedValueOnce(
        new Error('Database write failed')
      );

      const handler = handleOAuthCallback('google');
      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(env.CLIENT_FAILURE_REDIRECT);
    });
  });
});
