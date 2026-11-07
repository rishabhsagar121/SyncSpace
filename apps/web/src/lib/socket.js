import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL;
const apiOrigin = apiUrl?.replace(/\/api\/v1\/?$/, '');
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || apiOrigin || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket'],
      auth: (cb) => {
        cb({ token: window.localStorage.getItem('accessToken') });
      },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
