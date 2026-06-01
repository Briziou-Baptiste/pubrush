//
//  authStorage.ts
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'access_token';
const CURRENT_USER_ID_KEY = 'current_user_id';

type AuthListener = (token: string | null) => void;
const listeners = new Set<AuthListener>();

export function subscribeToAuthChanges(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(token: string | null) {
  listeners.forEach((listener) => {
    try {
      listener(token);
    } catch (e) {
      console.error('[authStorage] Failed to notify listener', e);
    }
  });
}

type JwtPayload = {
  sub?: string;
  email?: string;
  username?: string;
  is_admin?: boolean;
  exp?: number;
};

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  throw new Error('Impossible de décoder le token JWT.');
}

function parseJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Format de token invalide.');
  }

  const payloadString = decodeBase64Url(parts[1]);
  return JSON.parse(payloadString) as JwtPayload;
}

export async function saveSession(accessToken: string) {
  const payload = parseJwtPayload(accessToken);

  if (!payload.sub) {
    throw new Error("L'id utilisateur est absent du token.");
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, payload.sub);
  notifyListeners(accessToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getCurrentUserId() {
  const value = await SecureStore.getItemAsync(CURRENT_USER_ID_KEY);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('current_user_id');
  notifyListeners(null);
}

export async function getCurrentUser() {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  if (!token) {
    return null;
  }

  try {
    const payload = parseJwtPayload(token);

    return {
      id: payload.sub ? Number(payload.sub) : null,
      email: payload.email ?? '',
      username: payload.username ?? '',
      is_admin: payload.is_admin ?? false,
    };
  } catch {
    return null;
  }
}
