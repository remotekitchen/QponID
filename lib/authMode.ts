import { isAuthConfigured } from '@/lib/supabase';

const envMock = process.env.EXPO_PUBLIC_DEV_MOCK_AUTH === 'true';

/**
 * Dev-only bypass: no SMS, stores a fake session locally.
 * - Automatic in __DEV__ when Supabase env is not set.
 * - Or set EXPO_PUBLIC_DEV_MOCK_AUTH=true (never ship this to Play Store).
 */
export function isMockAuthAvailable(): boolean {
  if (envMock) return true;
  if (typeof __DEV__ !== 'undefined' && __DEV__ && !isAuthConfigured) return true;
  return false;
}
