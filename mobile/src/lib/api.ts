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
  token: string
): Promise<any[]> {
  let url = `${API_BASE_URL}/bars/search?q=${encodeURIComponent(query)}`;
  if (lat !== undefined && lon !== undefined) {
    url += `&lat=${lat}&lon=${lon}`;
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
  token: string
): Promise<any[]> {
  const url = `${API_BASE_URL}/bars/nearby?lat=${lat}&lon=${lon}&max_travel_time_minutes=${maxTravelTimeMinutes}`;

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
