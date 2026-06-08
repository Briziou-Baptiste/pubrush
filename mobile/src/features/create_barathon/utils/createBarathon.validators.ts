import { BarathonStopForm, CreateBarathonPayload } from '../types/createBarathon.types';

type ValidationResult = {
  valid: boolean;
  message?: string;
};

type ValidateInput = {
  name: string;
  startDate: Date | null;
  startTime: Date | null;
  travelTime: string;
  maxTimeInBar: string;
  stops: BarathonStopForm[];
};

export function mergeDateAndTime(date: Date, time: Date): Date {
  const merged = new Date(date);

  merged.setHours(time.getHours());
  merged.setMinutes(time.getMinutes());
  merged.setSeconds(0);
  merged.setMilliseconds(0);

  return merged;
}

export function validateBarathonForm(input: ValidateInput): ValidationResult {
  if (!input.name.trim()) {
    return { valid: false, message: 'Le nom du barathon est requis.' };
  }

  if (!input.startDate) {
    return { valid: false, message: 'La date de début est requise.' };
  }

  if (!input.startTime) {
    return { valid: false, message: "L'heure de début est requise." };
  }

  const start = mergeDateAndTime(input.startDate, input.startTime);


  const travel = Number(input.travelTime);
  if (!Number.isInteger(travel) || travel < 0) {
    return {
      valid: false,
      message: 'Le temps de trajet entre les bars doit être un entier supérieur ou égal à 0.',
    };
  }

  const maxTime = Number(input.maxTimeInBar);
  if (!Number.isInteger(maxTime) || maxTime <= 0) {
    return {
      valid: false,
      message: 'Le temps maximum dans un bar doit être un entier strictement positif.',
    };
  }

  if (input.stops.length === 0) {
    return {
      valid: false,
      message: 'Ajoute au moins une étape au barathon.',
    };
  }

  for (let index = 0; index < input.stops.length; index += 1) {
    const stop = input.stops[index];
    const position = index + 1;

    if (!stop.name.trim()) {
      return { valid: false, message: `Le nom de l'étape ${position} est requis.` };
    }

    const latitude = Number(stop.latitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return { valid: false, message: `La latitude de l'étape ${position} est invalide.` };
    }

    const longitude = Number(stop.longitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return { valid: false, message: `La longitude de l'étape ${position} est invalide.` };
    }
  }

  return { valid: true };
}

export function buildCreateBarathonPayload(input: {
  name: string;
  startDate: Date;
  startTime: Date;
  travelTime: string;
  maxTimeInBar: string;
  stops: BarathonStopForm[];
}): CreateBarathonPayload {
  const startDateTime = mergeDateAndTime(input.startDate, input.startTime);

  return {
    name: input.name.trim(),
    start_datetime: startDateTime.toISOString(),
    end_datetime: startDateTime.toISOString(),
    travel_time_between_bars_minutes: Number(input.travelTime),
    max_time_in_bar_minutes: Number(input.maxTimeInBar),
    participant_user_ids: [],
    stops: input.stops.map((stop, index) => ({
      name: stop.name.trim(),
      stop_type: stop.stopType,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      stop_order: index + 1,
    })),
  };
}
