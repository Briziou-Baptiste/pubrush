export function formatBarathonStatus(status?: string): string {
  switch (status) {
    case 'planned':
      return 'Planifié';

    case 'started':
      return 'En cours...';

    case 'completed':
      return 'Tournée terminée';

    case 'stopped':
      return 'Tournée interrompue';

    case 'failed':
      return 'Non démarré à temps';

    default:
      return 'Statut indisponible';
  }
}

// Lifecycle is stored by the API. The existing 70% target is only about stops;
// role descriptions are not recorded mission outcomes.
export function getBarathonOutcome(status?: string, stops?: { is_completed?: boolean }[]) {
  const knownProgress = !!stops?.length && stops.every(stop => typeof stop.is_completed === 'boolean');
  const completed = stops?.filter(stop => stop.is_completed === true).length ?? 0;
  const targetReached = knownProgress ? completed / stops!.length >= 0.7 : null;
  return {
    label: formatBarathonStatus(status),
    completedNormally: status === 'completed',
    targetReached,
    progressLabel: targetReached === null
      ? 'Résultat des étapes indisponible'
      : targetReached ? 'Objectif atteint — seuil requis : 70 %' : 'Objectif non atteint — seuil requis : 70 %',
  };
}
