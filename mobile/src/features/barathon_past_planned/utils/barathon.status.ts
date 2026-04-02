export function formatBarathonStatus(status: string): string {
  switch (status) {
    case 'planned':
      return 'Planifié';

    case 'in_progress':
      return 'En cours...';

    case 'finished':
      return 'Terminé';

    case 'failed':
      return 'Non accompli';

    default:
      return status;
  }
}
