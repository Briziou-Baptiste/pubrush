import { authenticatedJsonRequest } from '../../../lib/apiClient';
import { ActiveBarathonData } from '../types/activeBarathon.types';

export async function getMyActiveBarathon() {
  return authenticatedJsonRequest<ActiveBarathonData | null>(
    '/barathons/my/active',
    { method: 'GET' }
  );
}

export async function getBarathonById(barathonId: number) {
  return authenticatedJsonRequest<ActiveBarathonData>(
    `/barathons/${barathonId}/active-view`,
    { method: 'GET' }
  );
}

export async function markBarathonFinished(barathonId: number) {
  return authenticatedJsonRequest(`/barathons/${barathonId}/finish`, {
    method: 'POST',
  });
}

export async function stopBarathon(barathonId: number) {
  return authenticatedJsonRequest<{ id: number; status: string; ended_at: string }>(
    `/barathons/${barathonId}/stop`,
    {
      method: 'POST',
    }
  );
}

export async function completeBarathonStop(
  barathonId: number,
  stopId: number
) {
  return authenticatedJsonRequest(
    `/barathons/${barathonId}/stops/${stopId}/complete`,
    {
      method: 'POST',
    }
  );
}
