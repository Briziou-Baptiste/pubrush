export type CurrentUserRole = 'creator' | 'participant';

export type BarathonListItem = {
  id: number;
  name: string;
  start_datetime: string;
  has_started: boolean;
  status: string;
  travel_time_between_bars_minutes: number;
  max_time_in_bar_minutes: number;
  created_by_user_id: number;
  started_at: string | null;
  ended_at: string | null;
  end_datetime?: string | null;
  current_user_role?: CurrentUserRole;
  participants_count: number;
  stops: Array<{
    id: number;
    name: string;
    stop_type: string;
    latitude: number;
    longitude: number;
    stop_order: number;
    is_completed?: boolean;
  }>;
};
