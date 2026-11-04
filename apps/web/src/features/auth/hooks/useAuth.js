import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../api/authApi';
import {
  credentialsReceived,
  loggedOut,
  authLoading,
  authError,
  sessionRestored,
  selectCurrentUser,
} from '../authSlice';
import { connectSocket, disconnectSocket } from '@/lib/socket';

// On a hard refresh the Redux store resets but the access token survives in
// localStorage. This re-hydrates `user` from /users/me before anything that
// needs auth (like ProtectedRoute) makes a decision.
export function useBootstrapAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem('accessToken');
    if (!token || user) {
      setReady(true);
      return;
    }
    authApi
      .getMe()
      .then((freshUser) => {
        dispatch(sessionRestored(freshUser));
        connectSocket();
      })
      .catch(() => dispatch(loggedOut()))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

export function useRegister() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.register,
    onMutate: () => dispatch(authLoading()),
    onSuccess: ({ user, accessToken }) => {
      dispatch(credentialsReceived({ user, accessToken }));
      connectSocket();
      navigate('/app', { replace: true });
    },
    onError: () => dispatch(authError()),
  });
}

export function useLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.login,
    onMutate: () => dispatch(authLoading()),
    onSuccess: ({ user, accessToken }) => {
      dispatch(credentialsReceived({ user, accessToken }));
      connectSocket();
      navigate('/app', { replace: true });
    },
    onError: () => dispatch(authError()),
  });
}

export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      disconnectSocket();
      dispatch(loggedOut());
      navigate('/login', { replace: true });
    },
  });
}