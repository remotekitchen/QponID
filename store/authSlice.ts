import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthUserInfo = {
  id: string;
  phone: string | null;
  isMock: boolean;
  token?: string | null;
  userInfo?: unknown;
};

type BackendSession = {
  token: string;
  userInfo: unknown;
};

type AuthState = {
  authLoading: boolean;
  loginOpen: boolean;
  mockSession: { phone: string } | null;
  backendSession: BackendSession | null;
};

const initialState: AuthState = {
  authLoading: true,
  loginOpen: false,
  mockSession: null,
  backendSession: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.authLoading = action.payload;
    },
    setLoginOpen(state, action: PayloadAction<boolean>) {
      state.loginOpen = action.payload;
    },
    setMockSession(state, action: PayloadAction<{ phone: string } | null>) {
      state.mockSession = action.payload;
    },
    setBackendSession(state, action: PayloadAction<BackendSession | null>) {
      state.backendSession = action.payload;
    },
  },
});

export const { setAuthLoading, setLoginOpen, setMockSession, setBackendSession } = authSlice.actions;
export default authSlice.reducer;
