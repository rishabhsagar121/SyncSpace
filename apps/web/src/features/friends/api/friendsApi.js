import api from '@/lib/axios';

export const friendsApi = {
  list: async () => {
    const { data } = await api.get('/friends');
    return data.data.friends;
  },

  incoming: async () => {
    const { data } = await api.get('/friends/requests/incoming');
    return data.data.requests;
  },

  outgoing: async () => {
    const { data } = await api.get('/friends/requests/outgoing');
    return data.data.requests;
  },

  sendRequest: async (receiverId) => {
    const { data } = await api.post('/friends/requests', { receiverId });
    return data.data;
  },

  respond: async (requestId, accept) => {
    const { data } = await api.patch(`/friends/requests/${requestId}`, { accept });
    return data.data;
  },

  search: async (q) => {
    const { data } = await api.get('/users/search', { params: { q } });
    return data.data.users;
  },
};