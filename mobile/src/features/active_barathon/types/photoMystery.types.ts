export type PhotoSubmission = {
  choice_index: number | null;
  passed: boolean;
  submitted_at: string;
};

export type PhotoResult = {
  closed_at: string;
  reason: string;
  expected_count: number;
  correct_count: number;
  incorrect_count: number;
  passed_count: number;
  creator_dare: boolean;
  my_dare_assigned: boolean | null;
};

export type PhotoChallengeItem = {
  id: string;
  version: number;
  state: 'draft' | 'published' | 'closed' | 'cancelled' | 'expired';
  question: string | null;
  options: string[] | null;
  correct_index: number | null;
  expires_at: string | null;
  my_submission: PhotoSubmission | null;
  can_answer: boolean;
  photo_available: boolean;
  results: PhotoResult | null;
};

export type PhotoMysteryState = {
  server_time: string;
  enabled: boolean;
  can_create: boolean;
  pending_count: number;
  unseen_results_count: number;
  items: PhotoChallengeItem[];
};

// REST snapshots carry no room id: keep their provenance at the caller boundary.
export type PhotoMysterySnapshot = {
  barathonId: number;
  state: PhotoMysteryState;
};
