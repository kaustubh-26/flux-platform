import type { Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { extractTokenFromSocket, verifySessionToken } from './jwt';
import { logger } from '../logger';

export function resolveClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  return forwarded?.toString().split(',')[0].trim() || socket.handshake.address;
}

export function resolveGuestId(socket: Socket): string {
  const rawGuestId = socket.handshake.auth?.guestId;

  if (
    typeof rawGuestId === 'string' &&
    rawGuestId.trim().length > 0 &&
    rawGuestId.trim().length <= 128
  ) {
    return rawGuestId.trim();
  }

  return randomUUID();
}

/**
 * Socket.IO middleware that authenticates connections with JWT if present,
 * or gracefully falls back to guest identity if absent or invalid.
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  try {
    const ip = resolveClientIp(socket);
    const token = extractTokenFromSocket(socket);

    if (token) {
      try {
        const user = verifySessionToken(token);
        socket.data.user = {
          id: user.userId,
          type: 'authenticated',
          ip,
          user,
        };

        logger.debug(
          {
            socketId: socket.id,
            userId: user.userId,
            userType: 'authenticated',
            ip,
          },
          'Socket authenticated identity resolved'
        );

        return next();
      } catch (err) {
        logger.debug(
          { socketId: socket.id, err },
          'Invalid or expired token during socket handshake, preserving guest flow'
        );
      }
    }

    // Preserve Guest Flow
    const guestId = resolveGuestId(socket);
    socket.data.user = {
      id: guestId,
      type: 'guest',
      ip,
    };

    logger.debug(
      {
        socketId: socket.id,
        userId: guestId,
        userType: 'guest',
        ip,
      },
      'Socket guest identity resolved'
    );

    return next();
  } catch (err) {
    logger.error({ err, socketId: socket.id }, 'Failed to resolve socket identity');
    return next(new Error('Unable to initialize socket session'));
  }
}
