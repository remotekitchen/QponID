import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

const MOCK_SESSION_KEY = 'hungry-tiger-mock-session-v1';

export type AuthUserInfo = {
  id: string;
  phone: string | null;
  isMock: boolean;
};

type AuthContextValue = {
  user: AuthUserInfo | null;
  session: Session | null;
  authLoading: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  signOut: () => Promise<void>;
  signInWithMockPhone: (phoneE164: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mockSession, setMockSession] = useState<{ phone: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMock = AsyncStorage.getItem(MOCK_SESSION_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as { phone?: string };
        if (parsed?.phone) setMockSession({ phone: parsed.phone });
      } catch {
        /* ignore */
      }
    });

    if (!supabase) {
      loadMock.finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    void loadMock;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: s } }) => {
        if (cancelled) return;
        if (s?.user) {
          await AsyncStorage.removeItem(MOCK_SESSION_KEY);
          setMockSession(null);
        }
        setSession(s);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s?.user) {
        await AsyncStorage.removeItem(MOCK_SESSION_KEY);
        setMockSession(null);
      }
      setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  const signInWithMockPhone = useCallback(async (phoneE164: string) => {
    const payload = JSON.stringify({ phone: phoneE164 });
    await AsyncStorage.setItem(MOCK_SESSION_KEY, payload);
    setMockSession({ phone: phoneE164 });
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(MOCK_SESSION_KEY);
    setMockSession(null);
    setLoginOpen(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const user = useMemo<AuthUserInfo | null>(() => {
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
  }, [session, mockSession]);

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
    }),
    [user, session, authLoading, loginOpen, openLogin, closeLogin, signOut, signInWithMockPhone]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
