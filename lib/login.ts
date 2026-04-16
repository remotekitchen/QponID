import { toBangladeshE164 } from '@/lib/phone';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://api.hungrytiger.chatchefs.com';

type LoginResponse = {
  token: string;
  user_info: unknown;
};

function extractFirstApiError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
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

export async function loginWithPhone(input: { phoneLocal: string; password: string }): Promise<LoginResponse> {
  const phone = toBangladeshE164(input.phoneLocal);
  if (!phone) {
    throw new Error('Enter a valid Bangladesh mobile number (e.g. 01712345678).');
  }
  if (!input.password) {
    throw new Error('Password is required.');
  }

  const payload = { phone, password: input.password };

  const res = await fetch(`${API_BASE_URL}/api/accounts/v1/login/phone/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Login failed (${res.status})`;
    try {
      const data = (await res.json()) as unknown;
      const extracted = extractFirstApiError(data);
      if (extracted) message = extracted;
    } catch {
      try {
        const text = (await res.text()).trim();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  const data = (await res.json()) as Partial<LoginResponse>;
  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new Error('Login succeeded but no token was returned.');
  }

  return { token: data.token, user_info: data.user_info ?? null };
}

export async function loginWithEmail(input: { email: string; password: string }): Promise<LoginResponse> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (!input.password) {
    throw new Error('Password is required.');
  }

  const payload = { email, password: input.password };

  const res = await fetch(`${API_BASE_URL}/api/accounts/v1/login/email/?direct_order=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Login failed (${res.status})`;
    try {
      const data = (await res.json()) as unknown;
      const extracted = extractFirstApiError(data);
      if (extracted) message = extracted;
    } catch {
      try {
        const text = (await res.text()).trim();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  const data = (await res.json()) as Partial<LoginResponse>;
  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new Error('Login succeeded but no token was returned.');
  }

  return { token: data.token, user_info: data.user_info ?? null };
}

export async function loginWithGoogle(input: {
  accessToken: string;
  idToken?: string;
  code?: string;
}): Promise<LoginResponse> {
  const accessToken = input.accessToken?.trim();
  if (!accessToken) throw new Error('Google login failed: missing access token.');

  const payload = {
    access_token: accessToken,
    code: input.code ?? '',
    id_token: input.idToken ?? '',
  };

  const res = await fetch(`${API_BASE_URL}/api/accounts/v1/login/google/?direct_order=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Google login failed (${res.status})`;
    try {
      const data = (await res.json()) as unknown;
      const extracted = extractFirstApiError(data);
      if (extracted) message = extracted;
    } catch {
      try {
        const text = (await res.text()).trim();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  const data = (await res.json()) as Partial<LoginResponse>;
  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new Error('Google login succeeded but no token was returned.');
  }

  return { token: data.token, user_info: data.user_info ?? null };
}
