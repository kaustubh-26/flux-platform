import type { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../logger';
import type { AuthProvider } from '../models/user.model';
import { clearSessionCookie, setSessionCookie, signSessionToken, verifySessionToken } from '../services/jwt.service';
import { findOrCreateOAuthUser } from '../services/user.service';

export function handleOAuthCallback(provider: AuthProvider) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const oauthUser = req.user;

      if (!oauthUser || oauthUser.provider !== provider) {
        logger.warn(
          {
            expectedProvider: provider,
            receivedProvider: oauthUser?.provider,
          },
          'OAuth callback received invalid or missing authenticated user'
        );

        res.redirect(env.CLIENT_FAILURE_REDIRECT);
        return;
      }

      const user = await findOrCreateOAuthUser({
        provider: oauthUser.provider,
        providerId: oauthUser.providerId,
        email: oauthUser.email,
        name: oauthUser.name,
        avatarUrl: oauthUser.avatarUrl,
      });

      const token = signSessionToken(user);
      setSessionCookie(res, token);

      res.redirect(env.CLIENT_SUCCESS_REDIRECT);
    } catch (error) {
      logger.error({ err: error, provider }, 'OAuth callback failed');
      res.redirect(env.CLIENT_FAILURE_REDIRECT);
    }
  };
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.status(204).send();
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[env.COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      authenticated: false,
      message: 'No active session',
    });
    return;
  }

  try {
    const payload = verifySessionToken(token);

    res.status(200).json({
      authenticated: true,
      user: payload,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Failed to verify session token');

    res.status(401).json({
      authenticated: false,
      message: 'Invalid or expired session',
    });
  }
}