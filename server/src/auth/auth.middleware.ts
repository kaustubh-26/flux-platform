import type { Request, Response, NextFunction } from 'express';
import { extractTokenFromRequest, verifySessionToken } from './jwt';

/**
 * Middleware that strictly protects routes by enforcing a valid JWT.
 * Returns 401 Unauthorized if token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required: no session token provided',
    });
    return;
  }

  try {
    const user = verifySessionToken(token);
    req.user = user;
    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
    return;
  }
}

/**
 * Middleware that resolves identity if a valid JWT is present,
 * but allows unauthenticated/guest requests to proceed without error.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);

  if (token) {
    try {
      const user = verifySessionToken(token);
      req.user = user;
    } catch {
      // Ignored for optional identity resolution; req.user remains undefined
    }
  }

  next();
}
