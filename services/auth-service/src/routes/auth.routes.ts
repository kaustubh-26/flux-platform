import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import { configurePassport, enabledAuthProviders } from '../config/passport';
import { getCurrentUser, handleOAuthCallback, logout } from '../controllers/auth.controller';

configurePassport();

const router = Router();

type SupportedProvider = keyof typeof enabledAuthProviders;

function ensureProviderEnabled(provider: SupportedProvider) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (enabledAuthProviders[provider]) {
      next();
      return;
    }

    res.status(503).json({
      status: 'error',
      message: `${provider} OAuth is not configured`,
    });
  };
}

router.get(
  '/google',
  ensureProviderEnabled('google'),
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  ensureProviderEnabled('google'),
  passport.authenticate('google', {
    session: false,
    failureRedirect: env.CLIENT_FAILURE_REDIRECT,
  }),
  handleOAuthCallback('google')
);

router.get(
  '/github',
  ensureProviderEnabled('github'),
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
);

router.get(
  '/github/callback',
  ensureProviderEnabled('github'),
  passport.authenticate('github', {
    session: false,
    failureRedirect: env.CLIENT_FAILURE_REDIRECT,
  }),
  handleOAuthCallback('github')
);

router.get('/me', getCurrentUser);
router.post('/logout', logout);

export default router;