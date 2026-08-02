import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/src/config/env';
import { getToken } from '@/src/api';

let socketPromise: Promise<Socket | null> | null = null;
let currentSocket: Socket | null = null;

async function createSocket(): Promise<Socket | null> {
  if (!SOCKET_URL) return null;
  try {
    const token = await getToken();
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: token || '' },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000,
    });
    socket.on('connect_error', () => {});
    currentSocket = socket;
    return socket;
  } catch {
    return null;
  }
}

export async function connectRealtime(): Promise<Socket | null> {
  if (!socketPromise) socketPromise = createSocket();
  return socketPromise;
}

export function subscribeRealtime<T = any>(event: string, handler: (payload: T) => void) {
  let active = true;
  let socketRef: Socket | null = null;

  connectRealtime()
    .then(socket => {
      if (!active || !socket) return;
      socketRef = socket;
      socket.on(event, handler);
    })
    .catch(() => {
      socketRef = null;
    });

  return () => {
    active = false;
    if (socketRef) socketRef.off(event, handler);
  };
}

export function disconnectRealtime() {
  if (currentSocket) {
    currentSocket.disconnect();
    currentSocket = null;
  }
  socketPromise = null;
}

export async function reconnectRealtime() {
  disconnectRealtime();
  return connectRealtime();
}
