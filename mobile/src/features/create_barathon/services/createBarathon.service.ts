//
//  barathon.service.ts
//

import * as SecureStore from 'expo-secure-store';

import {
  CreateBarathonPayload,
  SearchUserResult,
} from '../types/createBarathon.types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.pubrush.com';

async function getAuthToken() {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  return token;
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.status === 408 || response.status >= 500) throw new CreationOutcomeUnknownError();

  if (!response.ok) {
    let message = 'Erreur serveur.';

    if (typeof data?.detail === 'string') {
      message = data.detail;
    }

    throw new Error(message);
  }

  return data as T;
}

export class CreationOutcomeUnknownError extends Error {}

export async function createBarathon(payload: CreateBarathonPayload) {
  const token = await getAuthToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/barathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CreationOutcomeUnknownError();
  }

  return handleJsonResponse(response);
}
