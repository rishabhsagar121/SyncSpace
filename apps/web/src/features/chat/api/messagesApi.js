// apps/web/src/features/chat/api/messagesApi.js
import api from '@/lib/axios';

export const messagesApi = {
  list: async (roomId, cursor) => {
    const { data } = await api.get(`/messages/room/${roomId}`, {
      params: cursor ? { cursor } : undefined,
    });
    // The server may answer { messages } or { data: { messages } }
    return data?.data?.messages ?? data?.messages ?? [];
  },

  send: async (roomId, { content, replyToId }) => {
    const { data } = await api.post(`/messages/room/${roomId}`, { content, replyToId });
    return data.data.message;
  },

  sendFile: async (roomId, file, replyToId) => {
    const form = new FormData();
    form.append('file', file);
    if (replyToId) form.append('replyToId', replyToId);
    const { data } = await api.post(`/messages/room/${roomId}/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.message;
  },

  edit: async (messageId, content) => {
    const { data } = await api.patch(`/messages/${messageId}`, { content });
    return data.data;
  },

  remove: async (messageId) => {
    const { data } = await api.delete(`/messages/${messageId}`);
    return data.data;
  },

  react: async (messageId, emoji) => {
    const { data } = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return data.data;
  },

  unreact: async (messageId, emoji) => {
    const { data } = await api.delete(`/messages/${messageId}/reactions`, { data: { emoji } });
    return data.data;
  },
};