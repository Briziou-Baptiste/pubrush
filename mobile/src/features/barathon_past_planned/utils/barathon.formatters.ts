export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
