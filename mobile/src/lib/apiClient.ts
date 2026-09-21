import { router } from 'expo-router';
import { getAccessToken, clearSession } from './authStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.pubrush.com';

async function getAccessTokenOrThrow() {
  const token = await getAccessToken();

  if (!token) {
    try {
      router.replace('/login');
    } catch {}
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  return token;
}

export async function authenticatedJsonRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    await clearSession();
    try {
      router.replace('/login');
    } catch {}
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Erreur serveur.';
    throw new Error(message);
  }

  return data as T;
}
