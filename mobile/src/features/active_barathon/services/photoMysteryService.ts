import { authenticatedJsonRequest } from '../../../lib/apiClient';
import { getAccessToken } from '../../../lib/authStorage';
import { PhotoChallengeItem, PhotoMysteryState } from '../types/photoMystery.types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.pubrush.com';

export async function fetchPhotoMysteryState(barathonId: number): Promise<PhotoMysteryState> {
  return authenticatedJsonRequest<PhotoMysteryState>(`/barathons/${barathonId}/photo-mystery`);
}

export async function createPhotoChallengeDraft(
  barathonId: number,
  payload: {
    question: string;
    options: string[];
    correct_index: number;
    notice_version?: string;
  }
): Promise<{
  id: string;
  state: string;
  upload_code: string;
  code_expires_at: string;
  draft_expires_at: string;
}> {
  return authenticatedJsonRequest(`/barathons/${barathonId}/photo-mystery/challenges`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function publishPhotoChallenge(
  barathonId: number,
  challengeId: string
): Promise<PhotoChallengeItem> {
  return authenticatedJsonRequest(`/barathons/${barathonId}/photo-mystery/challenges/${challengeId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ notice_version: 'photo-private-2026-10-v1' }),
  });
}

export async function submitPhotoAnswer(
  barathonId: number,
  challengeId: string,
  payload: { choice_index: number | null; passed: boolean }
): Promise<PhotoChallengeItem> {
  return authenticatedJsonRequest(`/barathons/${barathonId}/photo-mystery/challenges/${challengeId}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelPhotoChallenge(
  barathonId: number,
  challengeId: string
): Promise<void> {
  return authenticatedJsonRequest(`/barathons/${barathonId}/photo-mystery/challenges/${challengeId}`, {
    method: 'DELETE',
  });
}

export function getPhotoMediaUrl(barathonId: number, challengeId: string): string {
  return `${API_BASE_URL}/barathons/${barathonId}/photo-mystery/challenges/${challengeId}/photo`;
}

export async function getAuthHeadersForPhoto(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
