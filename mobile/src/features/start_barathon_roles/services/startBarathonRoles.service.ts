import { authenticatedJsonRequest } from '../../../lib/apiClient';
import { StartBarathonConfigResponse } from '../types/startBarathonRoles.types';

export async function getBarathonStartConfig(barathonId: number) {
  return authenticatedJsonRequest<StartBarathonConfigResponse>(
    `/barathons/${barathonId}/start-config`,
    {
      method: 'GET',
    }
  );
}

export async function assignRolesAndStartBarathon(
  barathonId: number,
  assignments: Array<{ user_id: number; role_id: number }>
) {
  return authenticatedJsonRequest<{ success: boolean; barathon_id: number }>(
    `/barathons/${barathonId}/assign-roles-and-start`,
    {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    }
  );
}

export async function startBarathonWithoutRoles(barathonId: number) {
  return authenticatedJsonRequest(`/barathons/${barathonId}/start`, {
    method: 'POST',
  });
}
