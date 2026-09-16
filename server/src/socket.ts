import http from 'http';
import { Server, Socket } from 'socket.io';
import { env } from './config/env';
import { socketAuthMiddleware } from './auth';

/**
 * Creates and configures a Socket.IO server with identity middleware.
 */
export function createSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach identity resolution middleware
  io.use(socketAuthMiddleware);

  return io;
}
