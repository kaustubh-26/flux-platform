import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from 'passport-google-oauth20';
import {
  Strategy as GitHubStrategy,
  Profile as GitHubProfile,
} from 'passport-github2';
import { env } from './env';
import { logger } from '../logger';
import type { AuthProvider } from '../models/user.model';

export interface OAuthAuthenticatedUser {
  provider: AuthProvider;
  providerId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

export const enabledAuthProviders = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
} as const;

let configured = false;

function mapGoogleProfile(profile: GoogleProfile): OAuthAuthenticatedUser {
  return {
    provider: 'google',
    providerId: profile.id,
    email: profile.emails?.[0]?.value ?? null,
    name: profile.displayName || 'Unknown User',
    avatarUrl: profile.photos?.[0]?.value ?? null,
  };
}

function mapGitHubProfile(profile: GitHubProfile): OAuthAuthenticatedUser {
  return {
    provider: 'github',
    providerId: profile.id,
    email: profile.emails?.[0]?.value ?? null,
    name: profile.displayName || profile.username || 'Unknown User',
    avatarUrl: profile.photos?.[0]?.value ?? null,
  };
}

export function configurePassport(): void {
  if (configured) return;

  if (enabledAuthProviders.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        (_accessToken, _refreshToken, profile, done) => {
          done(null, mapGoogleProfile(profile));
        }
      )
    );
  } else {
    logger.warn(
      'Google OAuth strategy not enabled; missing GOOGLECLIENTID or GOOGLECLIENTSECRET'
    );
  }

  if (enabledAuthProviders.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackURL: env.GITHUB_CALLBACK_URL,
          scope: ['user:email'],
        },
        (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          done(null, mapGitHubProfile(profile));
        }
      )
    );
  } else {
    logger.warn(
      'GitHub OAuth strategy not enabled; missing GITHUBCLIENTID or GITHUBCLIENTSECRET'
    );
  }

  configured = true;
}