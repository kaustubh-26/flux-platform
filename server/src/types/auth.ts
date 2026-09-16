import 'express';
import 'socket.io';

export interface AuthenticatedUser {
  userId: string;
  sub: string;
  provider: string;
  email: string | null;
  name: string;
}

export type SocketUserType = 'guest' | 'authenticated';

export interface AuthenticatedSocketUser {
  id: string; // userId
  type: 'authenticated';
  ip: string;
  user: AuthenticatedUser;
}

export interface GuestSocketUser {
  id: string; // guestId
  type: 'guest';
  ip: string;
}

export type SocketUser = AuthenticatedSocketUser | GuestSocketUser;

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser;
  }
}
