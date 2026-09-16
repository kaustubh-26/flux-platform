import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@/app';
import { env } from '@/config/env';

describe('BFF API Routes (integration)', () => {
  const testUser = {
    userId: 'user_integration_101',
    sub: 'user_integration_101',
    provider: 'google',
    email: 'integration@flux.local',
    name: 'Integration User',
  };

  const createValidToken = () => jwt.sign(testUser, env.JWT_SECRET, { expiresIn: '1h' });

  describe('GET /health', () => {
    it('returns service health status and environment', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('flux-platform-bff');
      expect(res.body.environment).toBeDefined();
    });
  });

  describe('GET /api/me (protected)', () => {
    it('rejects with 401 when no session cookie is provided', async () => {
      const res = await request(app).get('/api/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects with 401 when session cookie contains an invalid signature', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Cookie', [`${env.COOKIE_NAME}=corrupted-token-payload`]);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('resolves authenticated user profile when valid cookie is provided', async () => {
      const token = createValidToken();

      const res = await request(app)
        .get('/api/me')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toEqual(
        expect.objectContaining({
          userId: testUser.userId,
          email: testUser.email,
          provider: testUser.provider,
          name: testUser.name,
        })
      );
    });

    it('resolves authenticated user profile when valid token is in Authorization header', async () => {
      const token = createValidToken();

      const res = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.userId).toBe(testUser.userId);
    });
  });

  describe('GET /api/protected (guarded resource)', () => {
    it('rejects unauthorized requests with 401', async () => {
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
    });

    it('allows authorized requests with valid token and returns user details', async () => {
      const token = createValidToken();

      const res = await request(app)
        .get('/api/protected')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('Access granted');
      expect(res.body.user.userId).toBe(testUser.userId);
    });
  });

  describe('GET /api/session (optional identity resolution)', () => {
    it('returns authenticated: false when guest accesses the session endpoint', async () => {
      const res = await request(app).get('/api/session');

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.user).toBeNull();
    });

    it('returns authenticated: true and user profile when valid cookie is present', async () => {
      const token = createValidToken();

      const res = await request(app)
        .get('/api/session')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toEqual(
        expect.objectContaining({
          userId: testUser.userId,
          email: testUser.email,
        })
      );
    });
  });
});
