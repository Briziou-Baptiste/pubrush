import { SearchUserResult, StopType } from '../../create_barathon/types/createBarathon.types';

export type ExistingParticipant = {
  id: number;
  role: string;
  user: SearchUserResult;
};

export type ExistingStop = {
  id: number;
  name: string;
  stop_type: StopType;
  latitude: number;
  longitude: number;
  stop_order: number;
};

export type BarathonDetailsResponse = {
  id: number;
  name: string;
  start_datetime: string;
  end_datetime: string | null;
  has_started: boolean;
  status: string;
  travel_time_between_bars_minutes: number;
  max_time_in_bar_minutes: number;
  created_by_user_id: number;
  started_at: string | null;
  ended_at: string | null;
  participants: ExistingParticipant[];
  stops: ExistingStop[];
};

export type AddParticipantsPayload = {
  participant_user_ids: number[];
};
