export function secondsFromMinutes(minutes: number) {
  return Math.max(0, Math.round(minutes * 60));
}

export function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getTimerTone(remainingSeconds: number) {
  if (remainingSeconds <= 0) {
    return 'danger';
  }

  if (remainingSeconds <= 300) {
    return 'warning';
  }

  return 'normal';
}
