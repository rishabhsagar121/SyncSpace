// apps/web/src/features/notifications/api/notificationsApi.js
import api from '@/lib/axios';

export const notificationsApi = {
  list: async (unreadOnly = false) => {
    const { data } = await api.get('/notifications', { params: { unreadOnly } });
    return data.data.notifications;
  },

  unreadCount: async () => {
    const { data } = await api.get('/notifications/unread-count');
    return data.data.count;
  },

  markRead: async (id) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data.data;
  },

  markAllRead: async () => {
    const { data } = await api.patch('/notifications/read-all');
    return data.data;
  },
};