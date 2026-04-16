import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAuthLoading, setBackendSession, setLoginOpen, setMockSession, type AuthUserInfo } from '@/store/authSlice';

const MOCK_SESSION_KEY = 'hungry-tiger-mock-session-v1';
const BACKEND_SESSION_KEY = 'hungry-tiger-backend-session-v1';

type AuthContextValue = {
  user: AuthUserInfo | null;
  session: Session | null;
  authLoading: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  signOut: () => Promise<void>;
  signInWithMockPhone: (phoneE164: string) => Promise<void>;
  signInWithBackend: (token: string, userInfo: unknown) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { authLoading, loginOpen, mockSession, backendSession } = useAppSelector((s) => s.auth);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBackend = AsyncStorage.getItem(BACKEND_SESSION_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as { token?: string; userInfo?: unknown };
        if (typeof parsed?.token === 'string' && parsed.token) {
          dispatch(setBackendSession({ token: parsed.token, userInfo: parsed.userInfo ?? null }));
        }
      } catch {
        /* ignore */
      }
    });

    const loadMock = AsyncStorage.getItem(MOCK_SESSION_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as { phone?: string };
        if (parsed?.phone) dispatch(setMockSession({ phone: parsed.phone }));
      } catch {
        /* ignore */
      }
    });

    if (!supabase) {
      Promise.allSettled([loadMock, loadBackend]).finally(() => {
        if (!cancelled) dispatch(setAuthLoading(false));
      });
      return () => {
        cancelled = true;
      };
    }

    void loadMock;
    void loadBackend;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: s } }) => {
        if (cancelled) return;
        if (s?.user) {
          await AsyncStorage.removeItem(MOCK_SESSION_KEY);
          dispatch(setMockSession(null));
        }
        setSession(s);
      })
      .finally(() => {
        if (!cancelled) dispatch(setAuthLoading(false));
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s?.user) {
        await AsyncStorage.removeItem(MOCK_SESSION_KEY);
        dispatch(setMockSession(null));
      }
      setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [dispatch]);

  const openLogin = useCallback(() => dispatch(setLoginOpen(true)), [dispatch]);
  const closeLogin = useCallback(() => dispatch(setLoginOpen(false)), [dispatch]);

  const signInWithMockPhone = useCallback(async (phoneE164: string) => {
    const payload = JSON.stringify({ phone: phoneE164 });
    await AsyncStorage.setItem(MOCK_SESSION_KEY, payload);
    dispatch(setMockSession({ phone: phoneE164 }));
  }, [dispatch]);

  const signInWithBackend = useCallback(async (token: string, userInfo: unknown) => {
    const payload = JSON.stringify({ token, userInfo });
    await AsyncStorage.setItem(BACKEND_SESSION_KEY, payload);
    await AsyncStorage.removeItem(MOCK_SESSION_KEY);
    dispatch(setMockSession(null));
    dispatch(setBackendSession({ token, userInfo }));
  }, [dispatch]);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(MOCK_SESSION_KEY);
    dispatch(setMockSession(null));
    await AsyncStorage.removeItem(BACKEND_SESSION_KEY);
    dispatch(setBackendSession(null));
    dispatch(setLoginOpen(false));
    if (supabase) await supabase.auth.signOut();
  }, [dispatch]);

  const backendUser = useMemo(() => {
    const ui = backendSession?.userInfo;
    if (!ui || typeof ui !== 'object') return null;
    const obj = ui as Record<string, unknown>;
    const id =
      (typeof obj.id === 'string' && obj.id) ||
      (typeof obj.user_id === 'string' && obj.user_id) ||
      (typeof obj.uuid === 'string' && obj.uuid) ||
      null;
    const phone = typeof obj.phone === 'string' ? obj.phone : null;
    return { id, phone };
  }, [backendSession?.userInfo]);

  const user = useMemo<AuthUserInfo | null>(() => {
    if (backendSession?.token) {
      return {
        id: backendUser?.id ?? 'backend-user',
        phone: backendUser?.phone ?? null,
        isMock: false,
        token: backendSession.token,
        userInfo: backendSession.userInfo,
      };
    }
    if (session?.user) {
      return {
        id: session.user.id,
        phone: session.user.phone ?? null,
        isMock: false,
      };
    }
    if (mockSession) {
      return {
        id: 'dev-mock-session',
        phone: mockSession.phone,
        isMock: true,
      };
    }
    return null;
  }, [backendSession, backendUser, session, mockSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      authLoading,
      loginOpen,
      openLogin,
      closeLogin,
      signOut,
      signInWithMockPhone,
      signInWithBackend,
    }),
    [user, session, authLoading, loginOpen, openLogin, closeLogin, signOut, signInWithMockPhone, signInWithBackend]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
