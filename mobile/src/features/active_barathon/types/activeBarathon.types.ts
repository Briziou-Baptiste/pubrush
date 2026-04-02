export type ActiveBarathonStop = {
  id: number;
  name: string;
  stop_type: 'bar' | 'food';
  latitude: number;
  longitude: number;
  stop_order: number;
};

export type ActiveBarathonData = {
  id: number;
  name: string;
  status: 'started';
  start_datetime: string;
  end_datetime: string | null;
  max_time_in_bar_minutes: number;
  travel_time_between_bars_minutes: number;
  stops: ActiveBarathonStop[];
};

export type TrackingPhase = 'en_route' | 'in_stop' | 'overtime' | 'finished';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type ActiveBarathonState = {
  activeStopIndex: number;
  phase: TrackingPhase;
  currentLocation: LatLng | null;
  visitedPath: LatLng[];
  remainingSeconds: number;
  isInsideStopRadius: boolean;
  fiveMinNotificationId: string | null;
  overtimeNotificationId: string | null;
};
