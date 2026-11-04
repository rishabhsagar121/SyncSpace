import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { roomsApi } from '../api/roomsApi';

export function useMyRooms() {
  return useQuery({
    queryKey: ['rooms', 'mine'],
    queryFn: roomsApi.listMine,
  });
}

export function useRoom(roomId) {
  return useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => roomsApi.get(roomId),
    enabled: !!roomId,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: roomsApi.create,
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
      navigate(`/app/rooms/${room.id}`);
    },
  });
}

export function useJoinRoom() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: roomsApi.joinByCode,
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
      navigate(`/app/rooms/${room.id}`);
    },
  });
}