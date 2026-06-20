import * as SecureStore from 'expo-secure-store';
import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';
import { authenticatedJsonRequest } from '../../../lib/apiClient';
import { SearchUserResult } from '../../create_barathon/types/createBarathon.types';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.pubrush.com';

export async function getMyUpcomingBarathons(): Promise<BarathonListItem[]> {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  const response = await fetch(`${API_BASE_URL}/barathons/my/upcoming`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de charger les barathons prévus.');
  }

  return response.json();
}

export async function deleteBarathon(barathonId: number) {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = 'Impossible de supprimer le barathon.';

    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') {
        message = data.detail;
      }
    } catch {
      // no-op
    }

    throw new Error(message);
  }
}
export async function updateBarathonStartDatetime(
  barathonId: number,
  startDatetime: string
) {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}/start-datetime`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      start_datetime: startDatetime,
    }),
  });

  if (!response.ok) {
    let message = "Impossible de modifier l'heure du barathon.";

    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') {
        message = data.detail;
      }
    } catch {
      // no-op
    }

    throw new Error(message);
  }

  return response.json();
}

export async function startBarathon(barathonId: number) {
  return authenticatedJsonRequest(`/barathons/${barathonId}/start`, {
    method: 'POST',
  });
}

export async function getBarathonDetails(barathonId: number): Promise<any> {
  return authenticatedJsonRequest<any>(`/barathons/${barathonId}`, {
    method: 'GET',
  });
}

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  return authenticatedJsonRequest<SearchUserResult[]>(
    `/users/search?q=${encodeURIComponent(cleanQuery)}`,
    {
      method: 'GET',
    }
  );
}

export async function addParticipantsToBarathon(
  barathonId: number,
  userIds: number[]
): Promise<any> {
  return authenticatedJsonRequest<any>(
    `/barathons/${barathonId}/participants`,
    {
      method: 'POST',
      body: JSON.stringify({ participant_user_ids: userIds }),
    }
  );
}

export async function removeParticipantFromBarathon(
  barathonId: number,
  userId: number
): Promise<any> {
  return authenticatedJsonRequest<any>(
    `/barathons/${barathonId}/participants/${userId}`,
    {
      method: 'DELETE',
    }
  );
}
