import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth } from '../auth';

const router = Router();

/**
 * Public/optional route resolving session state for both authenticated users and guests.
 */
router.get('/session', optionalAuth, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    authenticated: !!req.user,
    user: req.user || null,
  });
});

/**
 * Protected route returning the authenticated user profile.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    authenticated: true,
    user: req.user,
  });
});

/**
 * Sample protected route for testing guarded resource access.
 */
router.get('/protected', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Access granted to protected BFF resource',
    user: req.user,
  });
});

export default router;
