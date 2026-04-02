import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://192.168.1.14:8000';

async function getAccessTokenOrThrow() {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
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
