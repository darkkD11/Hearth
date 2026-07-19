import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hearth/shared';

export type HearthSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = 'http://localhost:3001';

/** Create a Socket.IO client connected with the given JWT */
export function createSocket(token: string): HearthSocket {
  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  });
}
