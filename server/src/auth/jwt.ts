import jwt, { JwtPayload } from 'jsonwebtoken';
import type { Request } from 'express';
import type { Socket } from 'socket.io';
import { env } from '../config/env';
import type { AuthenticatedUser } from '../types/auth';

export interface SessionJwtPayload extends JwtPayload {
  sub: string;
  userId: string;
  provider: string;
  email: string | null;
  name: string;
}

/**
 * Parses raw Cookie header string into an object dictionary.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;

    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!key) continue;

    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }

  return cookies;
}

/**
 * Verifies a JWT token using JWT_SECRET and validates payload fields.
 */
export function verifySessionToken(
  token: string,
  secret: string = env.JWT_SECRET
): AuthenticatedUser {
  const decoded = jwt.verify(token, secret) as SessionJwtPayload;

  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }

  const userId = decoded.userId || decoded.sub;
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid token: missing userId or sub');
  }

  return {
    userId,
    sub: decoded.sub || userId,
    provider: typeof decoded.provider === 'string' ? decoded.provider : 'unknown',
    email: typeof decoded.email === 'string' ? decoded.email : null,
    name: typeof decoded.name === 'string' ? decoded.name : '',
  };
}

/**
 * Extracts the JWT token from an Express Request (cookies or Authorization header).
 */
export function extractTokenFromRequest(
  req: Request,
  cookieName: string = env.COOKIE_NAME
): string | null {
  // 1. Check req.cookies populated by cookie-parser
  if (req.cookies && typeof req.cookies[cookieName] === 'string' && req.cookies[cookieName].trim()) {
    return req.cookies[cookieName].trim();
  }

  // 2. Fallback to raw Cookie header
  const rawCookieHeader = req.headers?.cookie;
  if (rawCookieHeader) {
    const cookies = parseCookies(rawCookieHeader);
    if (cookies[cookieName]) {
      return cookies[cookieName];
    }
  }

  // 3. Fallback to Authorization: Bearer <token>
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extracts the JWT token from a Socket.IO handshake.
 */
export function extractTokenFromSocket(
  socket: Socket,
  cookieName: string = env.COOKIE_NAME
): string | null {
  // 1. Check handshake cookie header
  const rawCookieHeader = socket.handshake.headers?.cookie;
  if (rawCookieHeader) {
    const cookies = parseCookies(rawCookieHeader);
    if (cookies[cookieName]) {
      return cookies[cookieName];
    }
  }

  // 2. Fallback to handshake auth object: socket.handshake.auth.token
  const authPayload = socket.handshake.auth;
  if (authPayload && typeof authPayload.token === 'string' && authPayload.token.trim()) {
    return authPayload.token.trim();
  }

  // 3. Fallback to Authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
