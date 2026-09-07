/**
 * Integration Test
 * Focus:
 * - Express application middleware pipeline (cookieParser, express.json, CORS)
 * - End-to-end HTTP session resolution on /auth/me with signed JWT cookie
 * - Cookie invalidation on /auth/logout
 * - Service health status endpoint
 */

import request from 'supertest';
import app from '@/app';
import { env } from '@/config/env';
import { signSessionToken } from '@/services/jwt.service';

describe('authRoutes (integration)', () => {
  const testUser = {
    userId: 'github_102030',
    provider: 'github' as const,
    email: 'integration@flux.local',
    name: 'Integration User',
  };

  /**
   * Purpose:
   * Verifies Core behavior:
   * - /health endpoint returns HTTP 200 with service identity and environment
   */
  it('returns health status and environment details', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('auth-service');
    expect(res.body.environment).toBeDefined();
    expect(res.body.database).toBe('disconnected');
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - /auth/me returns 401 Unauthorized when no cookie header is supplied
   */
  it('rejects /auth/me with 401 when session cookie is absent', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      authenticated: false,
      message: 'No active session',
    });
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - /auth/me validates incoming HTTP-only session cookie and returns user profile
   */
  it('resolves authenticated user on /auth/me when valid cookie is provided', async () => {
    const validToken = signSessionToken(testUser);

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${validToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user).toEqual(
      expect.objectContaining({
        userId: testUser.userId,
        provider: testUser.provider,
        email: testUser.email,
        name: testUser.name,
      })
    );
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - /auth/me returns 401 Unauthorized when a tampered or invalid cookie is provided
   */
  it('rejects /auth/me with 401 when session cookie contains invalid signature', async () => {
    const corruptedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered';

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${corruptedToken}`]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      authenticated: false,
      message: 'Invalid or expired session',
    });
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - /auth/logout clears session cookie and returns 204 No Content
   */
  it('clears session cookie on /auth/logout', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(204);

    const setCookieHeaders = res.headers['set-cookie'];
    expect(setCookieHeaders).toBeDefined();

    const cookieString = Array.isArray(setCookieHeaders)
      ? setCookieHeaders.join('; ')
      : String(setCookieHeaders);

    expect(cookieString).toContain(env.COOKIE_NAME);
    // Clearing a cookie sets Max-Age=0 or an expired date
    expect(cookieString).toMatch(/(Expires=|Max-Age=0)/);
  });
});
