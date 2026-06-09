const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.pubrush.com';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pubrush_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export async function request(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Authentication
  async login(email: string, password: string) {
    const data = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      localStorage.setItem('pubrush_token', data.access_token);
    }
    return data;
  },

  async register(username: string, email: string, password: string) {
    return request('/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  logout() {
    localStorage.removeItem('pubrush_token');
  },

  async getMe() {
    return request('/me');
  },

  async getMeStats() {
    return request('/me/stats');
  },

  // Stats
  async getStats() {
    return request('/admin/stats');
  },

  // Users
  async getUsers() {
    return request('/admin/users');
  },

  async toggleAdmin(userId: number) {
    return request(`/admin/users/${userId}/toggle-admin`, {
      method: 'PUT',
    });
  },

  async deleteUser(userId: number) {
    return request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Partner Events
  async getEvents() {
    return request('/admin/partner-events');
  },

  async createEvent(payload: { name: string; code: string; description?: string; is_active: boolean; start_date?: string | null; end_date?: string | null; requires_ticket?: boolean }) {
    return request('/admin/partner-events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateEvent(eventId: number, payload: { name?: string; code?: string; description?: string; is_active?: boolean; start_date?: string | null; end_date?: string | null; requires_ticket?: boolean }) {
    return request(`/admin/partner-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteEvent(eventId: number) {
    return request(`/admin/partner-events/${eventId}`, {
      method: 'DELETE',
    });
  },

  async getEventTickets(eventId: number) {
    return request(`/admin/partner-events/${eventId}/tickets`);
  },

  async generateEventTickets(eventId: number, count: number) {
    return request(`/admin/partner-events/${eventId}/tickets/generate`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
  },

  // Map Filters
  async getFilters() {
    return request('/admin/map-filters');
  },

  async createFilter(payload: { key: string; label: string; icon: string; osm_query: string; google_type?: string; is_global: boolean }) {
    return request('/admin/map-filters', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateFilter(filterId: number, payload: { key?: string; label?: string; icon?: string; osm_query?: string; google_type?: string; is_global?: boolean }) {
    return request(`/admin/map-filters/${filterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteFilter(filterId: number) {
    return request(`/admin/map-filters/${filterId}`, {
      method: 'DELETE',
    });
  },

  // Link / Unlink Filter
  async linkFilter(eventId: number, filterId: number) {
    return request(`/admin/partner-events/${eventId}/filters/${filterId}`, {
      method: 'POST',
    });
  },

  async unlinkFilter(eventId: number, filterId: number) {
    return request(`/admin/partner-events/${eventId}/filters/${filterId}`, {
      method: 'DELETE',
    });
  },

  async getEventSpots(eventId: number) {
    return request(`/admin/partner-events/${eventId}/spots`);
  },

  async createEventSpot(eventId: number, payload: { name: string; spot_type: string; latitude: number; longitude: number; description?: string }) {
    return request(`/admin/partner-events/${eventId}/spots`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteEventSpot(eventId: number, spotId: number) {
    return request(`/admin/partner-events/${eventId}/spots/${spotId}`, {
      method: 'DELETE',
    });
  },
};

