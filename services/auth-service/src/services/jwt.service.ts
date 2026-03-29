import type { CookieOptions, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AuthProvider, IUser } from '../models/user.model';

export interface SessionJwtPayload {
  sub: string;
  userId: string;
  provider: AuthProvider;
  email: string | null;
  name: string;
}

function parseExpiresToMs(value: string): number | undefined {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return undefined;
  }
}

function buildCookieBaseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

export function buildSessionCookieOptions(): CookieOptions {
  const maxAge = parseExpiresToMs(env.JWT_EXPIRES_IN);

  return maxAge
    ? { ...buildCookieBaseOptions(), maxAge }
    : buildCookieBaseOptions();
}

export function signSessionToken(
  user: Pick<IUser, 'userId' | 'provider' | 'email' | 'name'>
): string {
  const payload: SessionJwtPayload = {
    sub: user.userId,
    userId: user.userId,
    provider: user.provider,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifySessionToken(token: string): SessionJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as SessionJwtPayload;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, buildSessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, buildCookieBaseOptions());
}