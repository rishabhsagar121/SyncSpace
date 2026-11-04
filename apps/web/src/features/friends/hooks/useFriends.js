// apps/web/src/features/friends/hooks/useFriends.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendsApi } from '../api/friendsApi';

export function useFriendsList() {
  return useQuery({
    queryKey: ['friends', 'list'],
    queryFn: friendsApi.list,
  });
}

export function useIncomingRequests() {
  return useQuery({
    queryKey: ['friends', 'incoming'],
    queryFn: friendsApi.incoming,
  });
}

export function useOutgoingRequests() {
  return useQuery({
    queryKey: ['friends', 'outgoing'],
    queryFn: friendsApi.outgoing,
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, accept }) => friendsApi.respond(requestId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (receiverId) => friendsApi.sendRequest(receiverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useUserSearch(q) {
  return useQuery({
    queryKey: ['users', 'search', q],
    queryFn: () => friendsApi.search(q),
    enabled: q.trim().length > 1,
  });
}