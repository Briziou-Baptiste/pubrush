import * as SecureStore from 'expo-secure-store';
import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';

const API_BASE_URL = 'http://192.168.1.14:8000';

export async function getMyPastBarathons(): Promise<BarathonListItem[]> {
  const token = await SecureStore.getItemAsync('access_token');

  if (!token) {
    throw new Error('Session expirée. Reconnecte-toi.');
  }

  const response = await fetch(`${API_BASE_URL}/barathons/my/past`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de charger les barathons passés.');
  }

  return response.json();
}
