export type WSMessage =
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'BARATHON_LIST_REFRESH'; barathon_id?: number }
  | {
      type: 'BARATHON_STARTED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        status?: string;
        started_by_user_id?: number;
      };
    }
  | {
      type: 'BARATHON_STOPPED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        status?: string;
      };
    }
  | {
      type: 'BARATHON_FINISHED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        status?: string;
      };
    }
  | {
      type: 'BARATHON_STOP_COMPLETED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        stop_id?: number;
        next_stop_index?: number;
        next_stop_id?: number;
        user_id?: number;
      };
    }
  | {
      type: 'BARATHON_NEXT_STEP';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        completed_stop_id?: number;
        next_stop_index?: number;
        next_stop_id?: number;
        user_id?: number;
      };
    }
  | {
      type: 'BARATHON_STOP_REPLACED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        stop_id: number;
        old_name: string;
        new_name: string;
        reason: string;
        user_id: number;
        username: string;
        stops: any[];
      };
    }
  | {
      type: 'BARATHON_STOP_ADDED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        added_stop: any;
        position: string;
        user_id: number;
        username: string;
        stops: any[];
      };
    }
  | {
      type: 'BARATHON_PARTICIPANT_JOINED';
      barathon_id: number;
      timestamp?: string;
      payload?: {
        user?: {
          id: number;
          username: string;
          is_guest?: boolean;
        };
        participants_count?: number;
      };
    }
  | {
      type: 'FRIEND_LOCATION_UPDATE';
      barathon_id: number;
      timestamp?: string;
      payload: ParticipantLocation;
    }
  | {
      type: 'FRIENDS_LOCATIONS_SNAPSHOT';
      barathon_id: number;
      timestamp?: string;
      payload: {
        locations: ParticipantLocation[];
      };
    };

export type ParticipantLocation = {
  user_id: number;
  username: string;
  latitude: number;
  longitude: number;
  is_guest?: boolean;
  updated_at?: string;
};
