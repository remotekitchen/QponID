import AsyncStorage from '@react-native-async-storage/async-storage';

import { toBangladeshE164 } from '@/lib/phone';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://api.hungrytiger.chatchefs.com';

const DEVICE_ID_KEY = 'hungry-tiger-device-id-v1';

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneLocal: string;
  referredBy?: string;
};

type RegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  referred_by?: string;
  device_id: string;
};

function extractFirstApiError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  // common shapes:
  // - { "detail": "..." }
  // - { "message": "..." }
  // - { "errors": { "email": ["..."] } }
  // - { "email": ["..."] } (Django REST Framework default)
  const obj = data as Record<string, unknown>;

  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
  if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail.trim();

  const errors = obj.errors;
  if (errors && typeof errors === 'object') {
    const eo = errors as Record<string, unknown>;
    const firstKey = Object.keys(eo)[0];
    const firstVal = firstKey ? eo[firstKey] : null;
    if (typeof firstVal === 'string' && firstVal.trim()) return firstVal.trim();
    if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') return (firstVal[0] as string).trim();
  }

  const firstKey = Object.keys(obj)[0];
  const firstVal = firstKey ? obj[firstKey] : null;
  if (typeof firstVal === 'string' && firstVal.trim()) return firstVal.trim();
  if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') return (firstVal[0] as string).trim();

  return null;
}

function createPseudoDeviceId() {
  const rand = Math.random().toString(36).slice(2, 12);
  return `web-${Date.now()}-${rand}`;
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = createPseudoDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export async function registerUser(input: RegisterInput): Promise<{ phoneE164: string }> {
  const phone = toBangladeshE164(input.phoneLocal);
  if (!phone) {
    throw new Error('Enter a valid Bangladesh mobile number (e.g. 01712345678).');
  }

  const payload: RegisterPayload = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    phone,
    device_id: await getDeviceId(),
  };

  const referredBy = input.referredBy?.trim();
  if (referredBy) payload.referred_by = referredBy;

  const res = await fetch(`${API_BASE_URL}/api/accounts/v1/user/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Registration failed (${res.status})`;
    try {
      const data = (await res.json()) as unknown;
      const extracted = extractFirstApiError(data);
      if (extracted) message = extracted;
    } catch {
      try {
        const text = (await res.text()).trim();
        if (text) message = text;
      } catch {
        // keep default message
      }
    }
    throw new Error(message);
  }

  return { phoneE164: phone };
}
