import jwt from 'jsonwebtoken';
import {
  parseCookies,
  verifySessionToken,
  extractTokenFromRequest,
  extractTokenFromSocket,
} from '@/auth/jwt';
import { env } from '@/config/env';

describe('JWT and Cookie Utilities (unit)', () => {
  const sampleUser = {
    userId: 'user_github_12345',
    sub: 'user_github_12345',
    provider: 'github',
    email: 'dev@flux.local',
    name: 'Flux Dev',
  };

  const createToken = (payload: object, secret: string = env.JWT_SECRET, expiresIn: string | number = '1h') => {
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  };

  describe('parseCookies', () => {
    it('parses valid cookie headers with multiple key-value pairs', () => {
      const header = 'theme=dark; flux_auth_token=jwt123; session_id=xyz';
      const cookies = parseCookies(header);

      expect(cookies).toEqual({
        theme: 'dark',
        flux_auth_token: 'jwt123',
        session_id: 'xyz',
      });
    });

    it('handles uri-encoded cookie values and whitespace', () => {
      const header = '  user_name=John%20Doe ;   other=val%3D123  ';
      const cookies = parseCookies(header);

      expect(cookies.user_name).toBe('John Doe');
      expect(cookies.other).toBe('val=123');
    });

    it('returns an empty object when cookie header is undefined or empty', () => {
      expect(parseCookies(undefined)).toEqual({});
      expect(parseCookies('')).toEqual({});
      expect(parseCookies('   ')).toEqual({});
    });
  });

  describe('verifySessionToken', () => {
    it('verifies and returns authenticated user identity from a valid token', () => {
      const token = createToken(sampleUser);
      const user = verifySessionToken(token);

      expect(user.userId).toBe(sampleUser.userId);
      expect(user.sub).toBe(sampleUser.sub);
      expect(user.provider).toBe(sampleUser.provider);
      expect(user.email).toBe(sampleUser.email);
      expect(user.name).toBe(sampleUser.name);
    });

    it('throws when the token has been tampered with or signed with another secret', () => {
      const token = createToken(sampleUser, 'wrong_secret');

      expect(() => verifySessionToken(token)).toThrow();
    });

    it('throws when the token is expired', () => {
      const expiredToken = createToken(sampleUser, env.JWT_SECRET, -10);

      expect(() => verifySessionToken(expiredToken)).toThrow();
    });

    it('throws when required identity fields (userId and sub) are missing', () => {
      const invalidPayloadToken = createToken({ email: 'test@example.com' });

      expect(() => verifySessionToken(invalidPayloadToken)).toThrow(
        'Invalid token: missing userId or sub'
      );
    });
  });

  describe('extractTokenFromRequest', () => {
    it('extracts token from parsed req.cookies', () => {
      const req = {
        cookies: { [env.COOKIE_NAME]: 'token-from-cookies' },
        headers: {},
      } as any;

      expect(extractTokenFromRequest(req)).toBe('token-from-cookies');
    });

    it('extracts token from raw cookie header when req.cookies is empty', () => {
      const req = {
        cookies: {},
        headers: { cookie: `${env.COOKIE_NAME}=token-from-header; other=1` },
      } as any;

      expect(extractTokenFromRequest(req)).toBe('token-from-header');
    });

    it('extracts token from Authorization Bearer header as fallback', () => {
      const req = {
        cookies: {},
        headers: { authorization: 'Bearer token-from-bearer' },
      } as any;

      expect(extractTokenFromRequest(req)).toBe('token-from-bearer');
    });

    it('returns null when no valid cookie or authorization header is present', () => {
      const req = {
        cookies: {},
        headers: {},
      } as any;

      expect(extractTokenFromRequest(req)).toBeNull();
    });
  });

  describe('extractTokenFromSocket', () => {
    it('extracts token from socket handshake cookie header', () => {
      const socket = {
        handshake: {
          headers: { cookie: `${env.COOKIE_NAME}=socket-token-123; foo=bar` },
          auth: {},
        },
      } as any;

      expect(extractTokenFromSocket(socket)).toBe('socket-token-123');
    });

    it('extracts token from socket handshake auth object as fallback', () => {
      const socket = {
        handshake: {
          headers: {},
          auth: { token: 'socket-auth-token-456' },
        },
      } as any;

      expect(extractTokenFromSocket(socket)).toBe('socket-auth-token-456');
    });

    it('extracts token from socket handshake authorization header as fallback', () => {
      const socket = {
        handshake: {
          headers: { authorization: 'Bearer socket-bearer-789' },
          auth: {},
        },
      } as any;

      expect(extractTokenFromSocket(socket)).toBe('socket-bearer-789');
    });

    it('returns null when socket handshake has no token', () => {
      const socket = {
        handshake: {
          headers: {},
          auth: {},
        },
      } as any;

      expect(extractTokenFromSocket(socket)).toBeNull();
    });
  });
});
