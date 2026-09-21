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

export async function advanceBarathonNextStep(barathonId: number) {
  return authenticatedJsonRequest<{
    success: boolean;
    completed_stop_id: number | null;
    next_stop_index: number;
    next_stop_id: number | null;
  }>(`/barathons/${barathonId}/next-step`, {
    method: 'POST',
  });
}

export async function getBarathonRoles(barathonId: number) {
  return authenticatedJsonRequest<
    {
      user_id: number;
      username: string;
      role_id: number;
      role_name: string;
      role_description?: string | null;
    }[]
  >(`/barathons/${barathonId}/roles`, {
    method: 'GET',
  });
}

export async function replaceBarathonStop(
  barathonId: number,
  stopId: number,
  payload: {
    name: string;
    latitude: number;
    longitude: number;
    stop_type?: string;
    reason: string;
  }
) {
  return authenticatedJsonRequest<ActiveBarathonData>(
    `/barathons/${barathonId}/stops/${stopId}/replace`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function addBarathonStop(
  barathonId: number,
  payload: {
    name: string;
    latitude: number;
    longitude: number;
    stop_type?: string;
    position: 'before_current' | 'after_current' | 'at_end';
    current_stop_id?: number;
  }
) {
  return authenticatedJsonRequest<ActiveBarathonData>(
    `/barathons/${barathonId}/stops/add`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

