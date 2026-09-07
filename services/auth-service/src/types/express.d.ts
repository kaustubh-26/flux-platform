import type { OAuthAuthenticatedUser } from '../config/passport';

export {};

declare global {
  namespace Express {
    interface User extends OAuthAuthenticatedUser {}

    interface Request {
      user?: User;
    }
  }
}