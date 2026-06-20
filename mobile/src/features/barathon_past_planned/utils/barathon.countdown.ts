import { parseApiDate } from '../../../lib/dateUtils';

export type CountdownLevel = 'normal' | 'warning' | 'danger';

type StartCountdownResult = {
  visible: boolean;
  remainingMs: number;
  label: string;
  title: string;
  level: CountdownLevel;
};

function isValidTimestamp(value: number) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days} j ${hours} h ${minutes} min`;
    }
    if (minutes > 0) {
      return `${days} j ${minutes} min`;
    }
    return `${days} j`;
  }

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, '0')} min ${seconds
      .toString()
      .padStart(2, '0')} s`;
  }

  if (minutes > 0) {
    return `${minutes} min ${seconds.toString().padStart(2, '0')} s`;
  }

  return `${seconds} s`;
}

export function getStartGraceCountdown(
  startDatetime: string,
  nowMs: number
): StartCountdownResult {
  const start = parseApiDate(startDatetime).getTime();

  if (!isValidTimestamp(start) || !isValidTimestamp(nowMs)) {
    return {
      visible: false,
      remainingMs: 0,
      label: '',
      title: '',
      level: 'normal',
    };
  }

  if (nowMs < start) {
    const remainingMs = start - nowMs;

    return {
      visible: true,
      remainingMs,
      label: formatDuration(remainingMs),
      title: 'Commence dans',
      level: 'normal',
    };
  }

  const graceDeadline = start + 15 * 60 * 1000;
  const remainingMs = graceDeadline - nowMs;

  if (remainingMs <= 0) {
    return {
      visible: false,
      remainingMs: 0,
      label: '',
      title: '',
      level: 'normal',
    };
  }

  let level: CountdownLevel = 'warning';

  if (remainingMs <= 5 * 60 * 1000) {
    level = 'danger';
  }

  return {
    visible: true,
    remainingMs,
    label: formatDuration(remainingMs),
    title: 'Temps restant pour le lancer',
    level,
  };
}
