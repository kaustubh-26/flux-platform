import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import app from '@/app';
import { createSocketServer } from '@/socket';
import { env } from '@/config/env';

describe('Socket.IO Identity Resolution (integration)', () => {
  let server: http.Server;
  let serverUrl: string;
  let io: any;

  const testUser = {
    userId: 'socket_user_999',
    sub: 'socket_user_999',
    provider: 'github',
    email: 'socket999@flux.local',
    name: 'Socket User',
  };

  const createValidToken = () => jwt.sign(testUser, env.JWT_SECRET, { expiresIn: '1h' });

  beforeAll((done) => {
    server = http.createServer(app);
    io = createSocketServer(server);

    io.on('connection', (socket: any) => {
      socket.emit('session:init', {
        userId: socket.data.user.id,
        userType: socket.data.user.type,
      });
    });

    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    io.close(() => {
      done();
    });
  });

  it('binds guest identity and emits session:init when guest connects without auth token', (done) => {
    const client = ClientSocket(serverUrl, {
      transports: ['websocket'],
      auth: { guestId: 'guest-integration-123' },
    });

    client.on('session:init', (session) => {
      expect(session).toEqual({
        userId: 'guest-integration-123',
        userType: 'guest',
      });
      client.disconnect();
      done();
    });
  });

  it('binds authenticated identity and emits session:init when valid cookie is provided', (done) => {
    const token = createValidToken();

    const client = ClientSocket(serverUrl, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: `${env.COOKIE_NAME}=${token}`,
      },
    });

    client.on('session:init', (session) => {
      expect(session).toEqual({
        userId: testUser.userId,
        userType: 'authenticated',
      });
      client.disconnect();
      done();
    });
  });

  it('binds authenticated identity when valid token is passed in auth payload', (done) => {
    const token = createValidToken();

    const client = ClientSocket(serverUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    client.on('session:init', (session) => {
      expect(session).toEqual({
        userId: testUser.userId,
        userType: 'authenticated',
      });
      client.disconnect();
      done();
    });
  });

  it('preserves guest flow when cookie contains an invalid or expired token', (done) => {
    const client = ClientSocket(serverUrl, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: `${env.COOKIE_NAME}=tampered-invalid-cookie`,
      },
      auth: { guestId: 'guest-fallback-456' },
    });

    client.on('session:init', (session) => {
      expect(session).toEqual({
        userId: 'guest-fallback-456',
        userType: 'guest',
      });
      client.disconnect();
      done();
    });
  });
});
