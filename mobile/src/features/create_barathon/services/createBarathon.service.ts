//
//  barathon.service.ts
//

import * as SecureStore from 'expo-secure-store';

import {
  CreateBarathonPayload,
  SearchUserResult,
} from '../types/createBarathon.types';

const API_BASE_URL = 'http://192.168.1.14:8000';

async function getAuthToken() {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  return token;
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Erreur serveur.';

    if (typeof data?.detail === 'string') {
      message = data.detail;
    }

    throw new Error(message);
  }

  return data as T;
}

export async function createBarathon(payload: CreateBarathonPayload) {
  const token = await getAuthToken();
    console.log('CREATE BARATHON PAYLOAD:', JSON.stringify(payload, null, 2));
  const response = await fetch(`${API_BASE_URL}/barathons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response);
}
