import api from '@/lib/axios';

export const roomsApi = {
  listMine: async () => {
    const { data } = await api.get('/rooms/mine');
    return data.data.rooms;
  },

  get: async (roomId) => {
    const { data } = await api.get(`/rooms/${roomId}`);
    return data.data.room;
  },

  create: async ({ name, visibility = 'PRIVATE', mode = 'YOUTUBE', password }) => {
    const { data } = await api.post('/rooms', { name, visibility, mode, password });
    return data.data.room;
  },

  joinByCode: async ({ code, password }) => {
    const { data } = await api.post('/rooms/join', { code, password });
    return data.data.room;
  },

  leave: async (roomId) => {
    const { data } = await api.post(`/rooms/${roomId}/leave`);
    return data.data;
  },

  updateMode: async (roomId, mode) => {
    const { data } = await api.patch(`/rooms/${roomId}/mode`, { mode });
    return data.data.room;
  },

  remove: async (roomId) => {
    const { data } = await api.delete(`/rooms/${roomId}`);
    return data.data;
  },
};