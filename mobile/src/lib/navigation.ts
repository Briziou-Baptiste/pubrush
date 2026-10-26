// Navigation UI policy. No business actions are triggered by returning from a screen.
export const navigationTitles: Record<string, string> = {
  register: 'Inscription', 'forgot-password': 'Mot de passe oublié',
  'reset-password': 'Nouveau mot de passe', planned: 'Barathons prévus', past: 'Historique',
  'create-barathon': 'Créer un barathon', 'create-barathon-map': 'Choisir les lieux',
  'create-barathon-recap': 'Récapitulatif', 'barathon-details': 'Détails du barathon',
  profile: 'Profil', 'profile-details': 'Informations personnelles', expenses: 'Mes dépenses',
  'barathon-expenses': 'Dépenses du barathon', 'saved-barathons': 'Barathons enregistrés',
  'start-barathon-roles': 'Attribution des rôles', events: 'Événements',
  'partner-event-map': "Carte de l’événement", 'barathon-stop-summary': 'Bilan du barathon',
};

type Params = Record<string, unknown>;
export type NavigationRoute = { name: string; params?: object; key?: string };

export function summaryDestination(params: object = {}): string {
  const source = (params as Params).source;
  return source === 'past' ? 'past' : source === 'active' ? 'planned' : 'home';
}

export function fallbackRoute(name: string, rawParams: object = {}): NavigationRoute {
  const params = rawParams as Params;
  switch (name) {
    case 'register': case 'forgot-password': return { name: 'login' };
    case 'reset-password': return { name: 'forgot-password' };
    case 'profile-details': case 'saved-barathons': case 'expenses': return { name: 'profile' };
    case 'partner-event-map': return { name: 'events' };
    case 'barathon-details': case 'start-barathon-roles': return { name: 'planned' };
    case 'barathon-expenses': return params.barathonId
      ? { name: 'barathon-details', params: { barathonId: params.barathonId } } : { name: 'expenses' };
    case 'barathon-stop-summary': return { name: summaryDestination(params) };
    case 'create-barathon-map': return { name: 'create-barathon', params: {
      initialName: params.name, initialTravelTime: params.travelTime,
      initialMaxTimeInBar: params.maxTimeInBar, initialStartDateTimeIso: params.startDateTimeIso,
      initialStopsJson: params.initialStopsJson,
    } };
    case 'create-barathon-recap': return { name: 'create-barathon-map', params: {
      ...params, initialStopsJson: params.stopsJson,
    } };
    default: return { name: 'home' };
  }
}

// Keep edits in the preceding configuration screen, without storing a draft on disk.
export function draftParentUpdate(routes: NavigationRoute[], currentKey: string, stopsJson: string) {
  const index = routes.findIndex(route => route.key === currentKey);
  const parent = routes[index - 1];
  return parent?.name === 'create-barathon' ? { key: parent.key, params: { initialStopsJson: stopsJson } } : null;
}

export function summaryHistory(routes: NavigationRoute[], current: NavigationRoute): NavigationRoute[] {
  const target = summaryDestination(current.params);
  const index = routes.findIndex(route => route.key === current.key);
  if (index > 0 && routes[index - 1].name === target) return routes;
  return [...(target === 'home' ? [] : [{ name: 'home' }]), { name: target }, current];
}
