/**
 * Focus:
 * - JWT token signing and payload structure
 * - Session token verification and error handling
 * - Cookie options construction and maxAge parsing
 * - Setting and clearing HTTP-only session cookies
 */

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  buildSessionCookieOptions,
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
  verifySessionToken,
} from '@/services/jwt.service';
import { env } from '@/config/env';

describe('jwt.service (unit)', () => {
  const mockUser = {
    userId: 'user-uuid-1234',
    provider: 'github' as const,
    email: 'developer@flux.local',
    name: 'Flux Developer',
  };

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Signs a JWT token containing all required session claims
   * - Sub claim is assigned the userId
   */
  it('signs a session token with standard and custom claims', () => {
    const token = signSessionToken(mockUser);
    expect(typeof token).toBe('string');

    const decoded = jwt.decode(token) as any;
    expect(decoded.sub).toBe(mockUser.userId);
    expect(decoded.userId).toBe(mockUser.userId);
    expect(decoded.provider).toBe('github');
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.name).toBe(mockUser.name);
    expect(decoded.exp).toBeDefined();
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Correctly verifies and decodes a signed token using secret
   * - Returns verified SessionJwtPayload
   */
  it('verifies a valid session token successfully', () => {
    const token = signSessionToken(mockUser);
    const payload = verifySessionToken(token);

    expect(payload.userId).toBe(mockUser.userId);
    expect(payload.provider).toBe(mockUser.provider);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.name).toBe(mockUser.name);
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Rejects tokens signed with an unauthorized secret
   * - Throws JsonWebTokenError
   */
  it('throws when verifying a token signed with an invalid secret', () => {
    const foreignToken = jwt.sign(
      { userId: mockUser.userId, provider: mockUser.provider },
      'wrong-secret-key-123'
    );

    expect(() => verifySessionToken(foreignToken)).toThrow(
      jwt.JsonWebTokenError
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Rejects expired session tokens
   * - Throws TokenExpiredError
   */
  it('throws when verifying an expired session token', () => {
    const expiredToken = jwt.sign(
      { userId: mockUser.userId, provider: mockUser.provider },
      env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    expect(() => verifySessionToken(expiredToken)).toThrow(
      jwt.TokenExpiredError
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Rejects malformed token strings
   * - Throws JsonWebTokenError
   */
  it('throws when verifying a malformed token string', () => {
    expect(() => verifySessionToken('invalid.token.structure')).toThrow(
      jwt.JsonWebTokenError
    );
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Generates cookie options with httpOnly: true and path: /
   * - Applies configured sameSite and secure flags
   */
  it('constructs base cookie options with httpOnly and security flags', () => {
    const options = buildSessionCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.secure).toBe(env.COOKIE_SECURE);
    expect(options.sameSite).toBe(env.COOKIE_SAME_SITE);
    expect(typeof options.maxAge).toBe('number');
    expect(options.maxAge).toBeGreaterThan(0);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Sets HTTP-only cookie with configured cookie name and token
   */
  it('sets session cookie on express response with appropriate options', () => {
    const mockRes = {
      cookie: jest.fn(),
    } as unknown as Response;

    const token = 'sample-jwt-token';
    setSessionCookie(mockRes, token);

    expect(mockRes.cookie).toHaveBeenCalledWith(
      env.COOKIE_NAME,
      token,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Clears session cookie on express response with identical base options
   */
  it('clears session cookie on express response', () => {
    const mockRes = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    clearSessionCookie(mockRes);

    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      env.COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );
  });
});
