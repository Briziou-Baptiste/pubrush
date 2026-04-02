export type StartConfigParticipant = {
  user_id: number;
  username: string;
  email: string;
};

export type StartConfigRole = {
  id: number;
  name: string;
  description: string | null;
};

export type StartBarathonConfigResponse = {
  barathon_id: number;
  barathon_name: string;
  participants: StartConfigParticipant[];
  roles: StartConfigRole[];
};

export type ParticipantRoleAssignment = {
  user_id: number;
  role_id: number | null;
};
