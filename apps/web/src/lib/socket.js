import axios from 'axios';
import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL;
const apiOrigin = apiUrl?.replace(/\/api\/v1\/?$/, '');
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || apiOrigin || 'http://localhost:5000';
const API_BASE = apiUrl || 'http://localhost:5000/api/v1';

let socket = null;
let renewing = false;

// The server refuses a connection whose login token has expired, and the browser does not try again by itself.
// So: get a fresh token (same way the rest of the app does), then connect again.
async function renewTokenAndReconnect() {
  if (renewing || !socket || !window.localStorage.getItem('accessToken')) return;
  renewing = true;
  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
    const token = data?.data?.accessToken ?? data?.accessToken;
    if (token) {
      window.localStorage.setItem('accessToken', token);
      socket.connect();
    }
  } catch {
    /* the session really ended: the next normal request sends the person to the login page */
  } finally {
    renewing = false;
  }
}

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

    socket.on('connect_error', (err) => {
      if (/token|authentication/i.test(err?.message || '')) renewTokenAndReconnect();
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