import api from '@/lib/axios';

export const authApi = {
  register: async ({ username, email, password }) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    return data.data;
  },

  login: async ({ identifier, password }) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    return data.data;
  },

  logout: async () => {
    const { data } = await api.post('/auth/logout');
    return data;
  },

  refresh: async () => {
    const { data } = await api.post('/auth/refresh');
    return data.data;
  },

  getMe: async () => {
    const { data } = await api.get('/users/me');
    return data.data.user;
  },
};