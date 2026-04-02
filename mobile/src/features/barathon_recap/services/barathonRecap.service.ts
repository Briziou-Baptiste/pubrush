import { authenticatedJsonRequest } from '../../../lib/apiClient';
import { SearchUserResult } from '../../create_barathon/types/createBarathon.types';
import {
  BarathonDetailsResponse,
  AddParticipantsPayload,
} from '../types/barathonRecap.types';

export async function searchUsers(query: string) {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return [] as SearchUserResult[];
  }

  return authenticatedJsonRequest<SearchUserResult[]>(
    `/users/search?q=${encodeURIComponent(cleanQuery)}`,
    {
      method: 'GET',
    }
  );
}

export async function getBarathonDetails(barathonId: number) {
  return authenticatedJsonRequest<BarathonDetailsResponse>(
    `/barathons/${barathonId}`,
    {
      method: 'GET',
    }
  );
}

export async function addParticipantsToBarathon(
  barathonId: number,
  payload: { participant_user_ids: number[] }
) {
    console.log(payload)
  return authenticatedJsonRequest(`/barathons/${barathonId}/participants`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
