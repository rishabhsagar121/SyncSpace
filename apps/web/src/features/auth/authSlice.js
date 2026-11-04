import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  accessToken: window.localStorage.getItem('accessToken') || null,
  status: 'idle',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action) {
      const { user, accessToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.status = 'authenticated';
      window.localStorage.setItem('accessToken', accessToken);
    },
    userUpdated(state, action) {
      state.user = { ...state.user, ...action.payload };
    },
    sessionRestored(state, action) {
      state.user = action.payload;
      state.status = 'authenticated';
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'idle';
      window.localStorage.removeItem('accessToken');
    },
    authLoading(state) {
      state.status = 'loading';
    },
    authError(state) {
      state.status = 'error';
    },
  },
});

export const {
  credentialsReceived,
  userUpdated,
  sessionRestored,
  loggedOut,
  authLoading,
  authError,
} = authSlice.actions;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.status === 'authenticated';

export default authSlice.reducer;