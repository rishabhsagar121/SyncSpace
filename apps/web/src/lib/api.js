import api from './axios';

const unwrap = (p) => p.then((r) => r.data);
export const errMsg = (e) => e?.response?.data?.message || 'Something went wrong. Try again.';

export const friendsApi = {
  list: () => unwrap(api.get('/friends')),
  requests: () => unwrap(api.get('/friends/requests')),
  send: (username) => unwrap(api.post('/friends/request', { username })),
  accept: (id) => unwrap(api.post(`/friends/requests/${id}/accept`)),
  decline: (id) => unwrap(api.post(`/friends/requests/${id}/decline`)),
  remove: (userId) => unwrap(api.delete(`/friends/${userId}`)),
};

export const roomsApi = {
  list: () => unwrap(api.get('/rooms')),
  get: (id) => unwrap(api.get(`/rooms/${id}`)),
  create: (data) => unwrap(api.post('/rooms', data)),
  join: (code) => unwrap(api.post('/rooms/join', { code })),
  remove: (id) => unwrap(api.delete(`/rooms/${id}`)),
};

export const messagesApi = {
  history: (roomId, cursor) =>
    unwrap(api.get(`/messages/room/${roomId}`, { params: cursor ? { cursor } : {} })),
};