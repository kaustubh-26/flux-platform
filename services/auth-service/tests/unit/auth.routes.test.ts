/**
 * Focus:
 * - Provider enabled middleware guard
 * - 503 response when OAuth provider credentials are not configured
 * - Mounting of OAuth, me, and logout routes
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '@/routes/auth.routes';

describe('auth.routes (unit)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Returns 503 Service Unavailable when Google OAuth is accessed without credentials
   */
  it('returns 503 when requesting unconfigured Google OAuth route', async () => {
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      message: 'google OAuth is not configured',
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Returns 503 Service Unavailable on Google callback when provider is disabled
   */
  it('returns 503 when requesting unconfigured Google callback route', async () => {
    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      message: 'google OAuth is not configured',
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Returns 503 Service Unavailable when GitHub OAuth is accessed without credentials
   */
  it('returns 503 when requesting unconfigured GitHub OAuth route', async () => {
    const res = await request(app).get('/auth/github');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      message: 'github OAuth is not configured',
    });
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Returns 503 Service Unavailable on GitHub callback when provider is disabled
   */
  it('returns 503 when requesting unconfigured GitHub callback route', async () => {
    const res = await request(app).get('/auth/github/callback');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      message: 'github OAuth is not configured',
    });
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Route /auth/me correctly handles requests (returns 401 when no session is present)
   */
  it('routes /auth/me to getCurrentUser handler', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Route /auth/logout correctly handles requests and clears cookie
   */
  it('routes /auth/logout to logout handler', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(204);
  });
});
