import api from '@/lib/axios';

export const musicApi = {
  search: async (q) => {
    const { data } = await api.get('/music/search', { params: { q } });
    return data.data.tracks;
  },

  resolve: async (url) => {
    const { data } = await api.get('/music/resolve', { params: { url } });
    return data.data.track;
  },
};