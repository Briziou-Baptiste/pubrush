export type StopType = string;

export type BarathonStopForm = {
  localId: string;
  name: string;
  stopType: StopType;
  latitude: string;
  longitude: string;
};

export type CreateBarathonPayload = {
  name: string;
  start_datetime: string;
  end_datetime: string;
  travel_time_between_bars_minutes: number;
  max_time_in_bar_minutes: number;
  participant_user_ids: number[];
  partner_event_id?: number | null;
  stops: Array<{
    name: string;
    stop_type: StopType;
    latitude: number;
    longitude: number;
    stop_order: number;
  }>;
};

export type CreateBarathonRecapStop = {
  id: string;
  name: string;
  stopType: StopType;
  latitude: number;
  longitude: number;
};

export type SearchUserResult = {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
};
