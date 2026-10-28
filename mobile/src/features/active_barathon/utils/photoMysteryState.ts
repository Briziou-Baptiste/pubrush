import { PhotoChallengeItem, PhotoMysteryState } from '../types/photoMystery.types';

export type ReconcileResult = {
  nextState: PhotoMysteryState;
  shouldUpdate: boolean;
};

export const TERMINAL_STATES: ReadonlySet<string> = new Set(['closed', 'cancelled', 'expired']);

function isStaleItem(current: PhotoChallengeItem, incoming: PhotoChallengeItem): boolean {
  return incoming.version < current.version ||
    (TERMINAL_STATES.has(current.state) && !TERMINAL_STATES.has(incoming.state));
}

/** Preserve newer versions, terminal states and already received private results. */
export function reconcilePhotoChallengeItem(
  current: PhotoChallengeItem,
  incoming: PhotoChallengeItem
): PhotoChallengeItem {
  if (isStaleItem(current, incoming)) return current;
  if (incoming.version !== current.version) return incoming;

  // Enrichment at the same version is not evidence that the snapshot is stale.
  return {
    ...incoming,
    ...(current.results && !incoming.results ? { results: current.results, state: current.state } : {}),
    ...(current.my_submission && !incoming.my_submission
      ? { my_submission: current.my_submission, can_answer: false } : {}),
  };
}

function unchanged(state: PhotoMysteryState | null): ReconcileResult {
  return { nextState: state as PhotoMysteryState, shouldUpdate: false };
}

function changed(current: PhotoMysteryState | null, next: PhotoMysteryState): ReconcileResult {
  return { nextState: next, shouldUpdate: JSON.stringify(current) !== JSON.stringify(next) };
}

/** A POST item can update the display, but carries no authoritative room counters.
 * Keep those from the last full snapshot until the authenticated GET completes.
 */
export function reconcileSingleItemIntoState(
  currentState: PhotoMysteryState | null,
  incomingItem: PhotoChallengeItem | null,
  currentBarathonId: number,
  targetBarathonId: number
): ReconcileResult {
  if (targetBarathonId !== currentBarathonId || !currentState || !incomingItem) {
    return unchanged(currentState);
  }
  const existing = currentState.items.find(item => item.id === incomingItem.id);
  const nextItem = existing ? reconcilePhotoChallengeItem(existing, incomingItem) : incomingItem;
  const items = existing
    ? currentState.items.map(item => item.id === nextItem.id ? nextItem : item)
    : [nextItem, ...currentState.items];
  return changed(currentState, { ...currentState, items });
}

/** Accept authoritative snapshots atomically, including permissions and counters.
 * Older timestamps or regressing items invalidate the snapshot as a whole: its
 * counters cannot safely be combined with newer local items. No business rights
 * are inferred from a participant's necessarily partial list of visible items.
 */
export function reconcilePhotoMysteryState(
  currentState: PhotoMysteryState | null,
  incomingState: PhotoMysteryState | null,
  currentBarathonId: number,
  incomingBarathonId: number
): ReconcileResult {
  if (incomingBarathonId !== currentBarathonId || !incomingState) return unchanged(currentState);
  if (!currentState) return changed(currentState, incomingState);

  if (Date.parse(incomingState.server_time) < Date.parse(currentState.server_time)) {
    return unchanged(currentState);
  }
  const currentItems = new Map(currentState.items.map(item => [item.id, item]));
  if (incomingState.items.some(item => {
    const current = currentItems.get(item.id);
    return current && isStaleItem(current, item);
  })) return unchanged(currentState);

  const items = incomingState.items.map(item => {
    const current = currentItems.get(item.id);
    return current ? reconcilePhotoChallengeItem(current, item) : item;
  });
  // Missing items are deletions, not a reason to reinject old challenges.
  return changed(currentState, { ...incomingState, items });
}
