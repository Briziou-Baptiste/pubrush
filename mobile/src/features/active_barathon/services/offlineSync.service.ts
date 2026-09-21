import * as SecureStore from 'expo-secure-store';
import { ActiveBarathonData } from '../types/activeBarathon.types';
import {
  advanceBarathonNextStep,
  completeBarathonStop,
  stopBarathon,
} from './activeBarathon.service';

const CACHED_BARATHON_KEY = 'pubrush_cached_active_barathon';
const OFFLINE_QUEUE_KEY = 'pubrush_offline_actions_queue';

export type OfflineAction =
  | {
      id: string;
      type: 'ADVANCE_STEP';
      barathonId: number;
      timestamp: number;
    }
  | {
      id: string;
      type: 'COMPLETE_STOP';
      barathonId: number;
      stopId: number;
      timestamp: number;
    }
  | {
      id: string;
      type: 'STOP_BARATHON';
      barathonId: number;
      timestamp: number;
    };

/**
 * Stores the active barathon in local storage for offline resilience (Mode Sous-sol).
 */
export async function saveCachedBarathon(barathon: ActiveBarathonData): Promise<void> {
  try {
    const json = JSON.stringify(barathon);
    await SecureStore.setItemAsync(CACHED_BARATHON_KEY, json);
  } catch (error) {
    console.warn('[OfflineSync] Failed to cache barathon locally:', error);
  }
}

/**
 * Retrieves the cached barathon from local storage when offline or network fails.
 */
export async function getCachedBarathon(): Promise<ActiveBarathonData | null> {
  try {
    const json = await SecureStore.getItemAsync(CACHED_BARATHON_KEY);
    if (!json) return null;
    return JSON.parse(json) as ActiveBarathonData;
  } catch (error) {
    console.warn('[OfflineSync] Failed to retrieve cached barathon:', error);
    return null;
  }
}

/**
 * Clears cached barathon on finish or stop.
 */
export async function clearCachedBarathon(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHED_BARATHON_KEY);
  } catch (error) {
    console.warn('[OfflineSync] Failed to clear cached barathon:', error);
  }
}

/**
 * Adds an action to the offline queue when cellular network is unavailable.
 */
export async function queueOfflineAction(
  action: Omit<OfflineAction, 'id' | 'timestamp'>
): Promise<OfflineAction> {
  const fullAction: OfflineAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  } as OfflineAction;

  try {
    const currentQueue = await getOfflineActionsQueue();
    currentQueue.push(fullAction);
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(currentQueue));
    console.log('[OfflineSync] Action queued for offline sync:', fullAction.type);
  } catch (error) {
    console.warn('[OfflineSync] Failed to queue offline action:', error);
  }

  return fullAction;
}

/**
 * Retrieves pending offline actions.
 */
export async function getOfflineActionsQueue(): Promise<OfflineAction[]> {
  try {
    const json = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!json) return [];
    return JSON.parse(json) as OfflineAction[];
  } catch {
    return [];
  }
}

/**
 * Flushes and executes all pending offline actions when connection is restored.
 */
export async function flushOfflineActionsQueue(): Promise<number> {
  const queue = await getOfflineActionsQueue();
  if (queue.length === 0) return 0;

  console.log(`[OfflineSync] Flushing ${queue.length} offline actions to server...`);
  const remaining: OfflineAction[] = [];
  let successCount = 0;

  for (const action of queue) {
    try {
      if (action.type === 'ADVANCE_STEP') {
        await advanceBarathonNextStep(action.barathonId);
      } else if (action.type === 'COMPLETE_STOP') {
        await completeBarathonStop(action.barathonId, action.stopId);
      } else if (action.type === 'STOP_BARATHON') {
        await stopBarathon(action.barathonId);
      }
      successCount++;
    } catch (error) {
      console.warn(`[OfflineSync] Failed to replay action ${action.id}, keeping in queue:`, error);
      remaining.push(action);
    }
  }

  try {
    if (remaining.length === 0) {
      await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    } else {
      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.warn('[OfflineSync] Error updating offline queue:', err);
  }

  return successCount;
}
