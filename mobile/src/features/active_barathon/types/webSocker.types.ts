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
        user_id?: number;
      };
    };
