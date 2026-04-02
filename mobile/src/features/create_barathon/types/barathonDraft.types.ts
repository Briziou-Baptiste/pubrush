export type BarathonDraftPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type BarathonDraft = {
  name: string;
  startDateIso: string;
  startTimeIso: string;
  travelTime: string;
  maxTimeInBar: string;
};
