// apps/web/src/features/notifications/hooks/useNotifications.js
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { notificationsApi } from '../api/notificationsApi';

const NOTIFICATION_NEW = 'notification:new';

export function useNotifications() {
  const queryClient = useQueryClient();
  const socket = getSocket();

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(),
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: notificationsApi.unreadCount,
  });

  useEffect(() => {
    const onNew = (notification) => {
      queryClient.setQueryData(['notifications', 'list'], (prev) =>
        prev ? [notification, ...prev] : [notification]
      );
      queryClient.setQueryData(['notifications', 'unreadCount'], (prev) => (prev ?? 0) + 1);
    };

    socket.on(NOTIFICATION_NEW, onNew);
    return () => socket.off(NOTIFICATION_NEW, onNew);
  }, [socket, queryClient]);

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: listQuery.data ?? [],
    loading: listQuery.isLoading,
    unreadCount: unreadCountQuery.data ?? 0,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}