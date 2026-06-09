//
//  api.ts
//  
//
//  Created by Baptiste Briziou on 30/03/2026.
//

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.pubrush.com';

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export type MeResponse = {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
};

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Erreur serveur';
    throw new Error(message);
  }

  return data as T;
}

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<MeResponse>(response);
}

export async function loginUser(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  console.log('LOGIN STATUS:', response.status);
  console.log('LOGIN RESPONSE:', rawText);

  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { detail: rawText };
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : JSON.stringify(data?.detail ?? data)
    );
  }

  return data as { access_token: string; token_type: string };
}

export async function fetchMe(token: string) {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<MeResponse>(response);
}

export async function changePassword(
  payload: { old_password: string; new_password: string },
  token: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<{ message: string }>(response);
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/forgot-password/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  return handleResponse<{ message: string }>(response);
}

export async function resetPassword(payload: {
  email: string;
  code: string;
  new_password: string;
}): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/forgot-password/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<{ message: string }>(response);
}

export async function fetchMyRoleInBarathon(barathonId: number, token: string): Promise<{ role: string | null }> {
  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}/my-role`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ role: string | null }>(response);
}

export async function fetchBarathon(barathonId: number, token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any>(response);
}

export async function fetchBarathonExpenses(barathonId: number, token: string): Promise<{ expenses: any[], balances: any[] }> {
  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}/expenses`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ expenses: any[], balances: any[] }>(response);
}

export async function createBarathonExpense(
  barathonId: number,
  payload: {
    payer_user_id: number;
    amount: number;
    description?: string;
    beneficiary_user_ids: number[];
    is_refund?: boolean;
  },
  token: string
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<any>(response);
}

export async function fetchBarsSearch(
  query: string,
  lat: number | undefined,
  lon: number | undefined,
  token: string,
  filterKey?: string
): Promise<any[]> {
  let url = `${API_BASE_URL}/bars/search?q=${encodeURIComponent(query)}`;
  if (lat !== undefined && lon !== undefined) {
    url += `&lat=${lat}&lon=${lon}`;
  }
  if (filterKey) {
    url += `&filter_key=${encodeURIComponent(filterKey)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any[]>(response);
}

export async function fetchNearbyBars(
  lat: number,
  lon: number,
  maxTravelTimeMinutes: number,
  token: string,
  filterKey?: string
): Promise<any[]> {
  let url = `${API_BASE_URL}/bars/nearby?lat=${lat}&lon=${lon}&max_travel_time_minutes=${maxTravelTimeMinutes}`;
  if (filterKey) {
    url += `&filter_key=${encodeURIComponent(filterKey)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any[]>(response);
}

export async function updateUsername(username: string, token: string): Promise<MeResponse> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username }),
  });

  return handleResponse<MeResponse>(response);
}

export async function deleteAccount(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string }>(response);
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/check-username?username=${encodeURIComponent(username)}`, {
    method: 'GET',
  });
  const data = await handleResponse<{ available: boolean }>(response);
  return data.available;
}


export type UserStats = {
  barathons_created: number;
  barathons_completed: number;
  bars_visited: number;
};

export async function fetchUserStats(token: string): Promise<UserStats> {
  const response = await fetch(`${API_BASE_URL}/me/stats`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<UserStats>(response);
}

export type BarathonBalance = {
  barathon_id: number;
  barathon_name: string;
  balance: number;
  status: string;
};

export async function fetchMyBarathonBalances(token: string): Promise<BarathonBalance[]> {
  const response = await fetch(`${API_BASE_URL}/barathons/my/balances`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<BarathonBalance[]>(response);
}

export type SavedBarathonStop = {
  id: number;
  name: string;
  stop_type: string;
  latitude: number;
  longitude: number;
  stop_order: number;
};

export type SavedBarathon = {
  id: number;
  user_id: number;
  name: string;
  travel_time_between_bars_minutes: number;
  max_time_in_bar_minutes: number;
  created_at: string;
  stops: SavedBarathonStop[];
};

export async function savePastBarathon(barathonId: number, name: string, token: string): Promise<SavedBarathon> {
  const response = await fetch(`${API_BASE_URL}/barathons/${barathonId}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  return handleResponse<SavedBarathon>(response);
}

export async function fetchMySavedBarathons(token: string): Promise<SavedBarathon[]> {
  const response = await fetch(`${API_BASE_URL}/saved-barathons`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<SavedBarathon[]>(response);
}

export async function deleteSavedBarathon(savedId: number, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/saved-barathons/${savedId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Erreur lors de la suppression.');
  }
}

export async function validatePartnerEvent(code: string, token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/partner-events/validate?code=${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any>(response);
}

export async function fetchMapFilters(partnerEventId: number | null, token: string): Promise<any[]> {
  let url = `${API_BASE_URL}/map-filters`;
  if (partnerEventId) {
    url += `?partner_event_id=${partnerEventId}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any[]>(response);
}

export async function fetchPartnerEvents(token: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/partner-events`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<any[]>(response);
}

export async function redeemTicketCode(ticketCode: string, token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/partner-events/redeem-ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ticket_code: ticketCode }),
  });
  return handleResponse<any>(response);
}



