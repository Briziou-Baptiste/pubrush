import { parseApiDate } from '../../../lib/dateUtils';

export function formatDate(value: string) {
  return parseApiDate(value).toLocaleDateString('fr-FR');
}

export function formatTime(value: string) {
  return parseApiDate(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
