import api from '@/lib/axios';

export const profileApi = {
  get: async (userId) => {
    const { data } = await api.get(`/users/${userId}`);
    return data.data.user;
  },
};