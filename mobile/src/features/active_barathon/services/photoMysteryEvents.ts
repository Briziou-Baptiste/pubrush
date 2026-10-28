export type PhotoMysteryEvent = {
  type: 'PHOTO_MYSTERY_UPDATE';
  barathon_id: number;
  challenge_id: string;
  // Optional while a previous backend is still serving unversioned events.
  version?: number;
  action: 'published' | 'answered' | 'closed' | 'cancelled' | 'expired';
};

type PhotoEventListener = (event: PhotoMysteryEvent) => void;

const photoEventListeners = new Set<PhotoEventListener>();

// Versions identify mutations, not arrival times. Keep interleaved transport copies
// across reconnects, with bounded memory. Unidentified legacy events are never dropped.
const deliveredEvents = new Set<string>();
const MAX_DELIVERED_EVENTS = 256;

export function subscribePhotoMysteryEvents(listener: PhotoEventListener): () => void {
  photoEventListeners.add(listener);
  return () => {
    photoEventListeners.delete(listener);
  };
}

export function emitPhotoMysteryEvent(event: PhotoMysteryEvent): void {
  if (Number.isSafeInteger(event.version) && event.version! > 0) {
    const eventKey = `${event.barathon_id}:${event.challenge_id}:${event.version}:${event.action}`;
    if (deliveredEvents.has(eventKey)) return;
    deliveredEvents.add(eventKey);
    if (deliveredEvents.size > MAX_DELIVERED_EVENTS) {
      deliveredEvents.delete(deliveredEvents.values().next().value!);
    }
  }

  for (const listener of photoEventListeners) {
    try {
      listener(event);
    } catch {
      // Pas de propagation d'erreur vers l'émetteur
    }
  }
}

/**
 * Réinitialise le filtre de déduplication (utile pour les tests unitaires)
 */
export function resetPhotoEventsDedup(): void {
  deliveredEvents.clear();
}
