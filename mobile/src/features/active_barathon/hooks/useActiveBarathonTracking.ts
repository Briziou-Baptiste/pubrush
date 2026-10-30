import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

import {
  ActiveBarathonData,
  ActiveBarathonState,
  ActiveBarathonStop,
  LatLng,
} from '../types/activeBarathon.types';
import { completeBarathonStop } from '../services/activeBarathon.service';
import { getDistanceMeters } from '../utils/activeBarathon.distance';
import { secondsFromMinutes } from '../utils/activeBarathon.timer';
import {
  cancelStopNotifications,
  ensureNotificationPermissions,
  scheduleFiveMinutesLeftNotification,
  scheduleOvertimeNotification,
} from '../services/activeBarathonNotifications.service';
import { openWalkingDirectionsInGoogleMaps } from '../services/activeBarathonNavigation.service';

type Params = {
  barathon: ActiveBarathonData;
  onStopCompleted?: (stopId: number) => void;
};

export function useActiveBarathonTracking({ barathon, onStopCompleted }: Params) {
  const maxBarSeconds = useMemo(
    () => secondsFromMinutes(barathon.max_time_in_bar_minutes),
    [barathon.max_time_in_bar_minutes]
  );

    const ENTER_RADIUS_METERS = 50;

    
  const firstIncompleteIdx = barathon.stops.findIndex((s) => !s.is_completed);
  const initialStopIndex = firstIncompleteIdx === -1 ? 0 : firstIncompleteIdx;

  const [state, setState] = useState<ActiveBarathonState>({
    activeStopIndex: initialStopIndex,
    phase: 'en_route',
    currentLocation: null,
    visitedPath: [],
    remainingSeconds: maxBarSeconds,
    isInsideStopRadius: false,
    fiveMinNotificationId: null,
    overtimeNotificationId: null,
  });

  const [timerReady, setTimerReady] = useState(false);
  const hydratedTimerKeyRef = useRef<string | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedTimerForCurrentStopRef = useRef(false);
  const currentStopIdRef = useRef<number | null>(null);
  const notificationIdsRef = useRef<{
    fiveMin: string | null;
    overtime: string | null;
  }>({
    fiveMin: null,
    overtime: null,
  });

  const activeStop: ActiveBarathonStop | null =
    barathon.stops[state.activeStopIndex] ?? null;

  const nextStop: ActiveBarathonStop | null =
    barathon.stops[state.activeStopIndex + 1] ?? null;
  const stopDeadlineRef = useRef<number | null>(null);
  const activeStopLocation: LatLng | null = activeStop
    ? {
        latitude: activeStop.latitude,
        longitude: activeStop.longitude,
      }
    : null;

  const distanceToActiveStopMeters = useMemo(() => {
    if (!state.currentLocation || !activeStopLocation) {
      return null;
    }

    return Math.round(getDistanceMeters(state.currentLocation, activeStopLocation));
  }, [state.currentLocation, activeStopLocation]);

  const estimatedWalkMinutes = useMemo(() => {
    if (distanceToActiveStopMeters === null) {
      return null;
    }
    return Math.max(1, Math.round(distanceToActiveStopMeters / 80));
  }, [distanceToActiveStopMeters]);

  useEffect(() => {
    void ensureNotificationPermissions();
    void startLocationTracking();

    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Immediate GPS fix upon unlocking the phone / returning to foreground
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((loc) => {
            const freshPos = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setState((prev) => ({
              ...prev,
              currentLocation: freshPos,
            }));
          })
          .catch(() => {});

        if (stopDeadlineRef.current) {
          const secondsLeft = Math.max(
            0,
            Math.ceil((stopDeadlineRef.current - Date.now()) / 1000)
          );

          if (secondsLeft <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            stopDeadlineRef.current = null;
            void cancelStopNotifications(notificationIdsRef.current);
            setState((prev) => ({
              ...prev,
              remainingSeconds: 0,
              phase: 'overtime',
              isInsideStopRadius: true,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              remainingSeconds: secondsLeft,
              phase: 'in_stop',
              isInsideStopRadius: true,
            }));
          }
        }
      }
    });

    return () => {
      appStateSub.remove();
      void stopTracking();
    };
  }, []);

  useEffect(() => {
    if (!barathon || barathon.stops.length === 0) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    void cancelStopNotifications(notificationIdsRef.current);

    notificationIdsRef.current = {
      fiveMin: null,
      overtime: null,
    };

    const firstIncomplete = barathon.stops.findIndex((s) => !s.is_completed);
    const resolvedIndex = firstIncomplete === -1 ? 0 : firstIncomplete;

    hasStartedTimerForCurrentStopRef.current = false;
    currentStopIdRef.current = barathon.stops[resolvedIndex]?.id ?? null;

    setState((prev) => ({
      ...prev,
      activeStopIndex: resolvedIndex,
      phase: 'en_route',
      remainingSeconds: maxBarSeconds,
      isInsideStopRadius: false,
      fiveMinNotificationId: null,
      overtimeNotificationId: null,
    }));
  }, [barathon.id]);

  useEffect(() => {
    if (!activeStop) {
      return;
    }

    if (currentStopIdRef.current !== activeStop.id) {
      currentStopIdRef.current = activeStop.id;
      stopDeadlineRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      hasStartedTimerForCurrentStopRef.current = false;

      setState((prev) => ({
        ...prev,
        phase: 'en_route',
        remainingSeconds: maxBarSeconds,
        isInsideStopRadius: false,
        fiveMinNotificationId: null,
        overtimeNotificationId: null,
      }));
    }
  }, [activeStop?.id, maxBarSeconds]);

  useEffect(() => {
    if (!activeStop) return;
    let cancelled = false;
    hydratedTimerKeyRef.current = null;
    setTimerReady(false);
    const key = `stop_timer_${barathon.id}_${activeStop.id}`;
    void SecureStore.getItemAsync(key).then((value) => {
      if (cancelled) return;
      const deadline = Number(value);
      if (value && Number.isFinite(deadline) && deadline > 0) {
        void startStopTimer(deadline);
      }
      hydratedTimerKeyRef.current = key;
      setTimerReady(true);
    }).catch(() => { if (!cancelled) { hydratedTimerKeyRef.current = key; setTimerReady(true); } });
    return () => { cancelled = true; };
  }, [barathon.id, activeStop?.id]);

  useEffect(() => {
    if (!timerReady || !activeStop || hydratedTimerKeyRef.current !== `stop_timer_${barathon.id}_${activeStop.id}` || !state.currentLocation || !activeStopLocation) return;
    if (!hasStartedTimerForCurrentStopRef.current &&
        getDistanceMeters(state.currentLocation, activeStopLocation) <= ENTER_RADIUS_METERS) {
      void startStopTimer();
    }
  }, [timerReady, state.currentLocation, activeStop?.id]);

  async function startLocationTracking() {
    if (locationSubscriptionRef.current) {
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 60000,
    });
    if (lastKnown) {
      const initialPosition = {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };

      setState((prev) => ({
        ...prev,
        currentLocation: initialPosition,
        visitedPath:
          prev.visitedPath.length === 0 ? [initialPosition] : prev.visitedPath,
      }));
    }

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2500,
        distanceInterval: 4,
      },
      (location) => {
        const newPosition = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setState((prev) => {
          const lastPos = prev.visitedPath[prev.visitedPath.length - 1];
          let shouldAdd = true;
          if (lastPos) {
            const dist = getDistanceMeters(lastPos, newPosition);
            if (dist < 15) {
              shouldAdd = false;
            }
          }
          const updatedVisited = shouldAdd
            ? (prev.visitedPath.length >= 400
                ? [...prev.visitedPath.slice(-350), newPosition]
                : [...prev.visitedPath, newPosition])
            : prev.visitedPath;

          return {
            ...prev,
            currentLocation: newPosition,
            visitedPath: updatedVisited,
          };
        });
      }
    );
  }

    async function startStopTimer(savedDeadline?: number) {
      if (!activeStop) {
        return;
      }

      if (hasStartedTimerForCurrentStopRef.current) {
        return;
      }

      hasStartedTimerForCurrentStopRef.current = true;

      // 1. Immediately start local real-time countdown
      const now = Date.now();
      stopDeadlineRef.current = savedDeadline ?? now + maxBarSeconds * 1000;
      const deadline = stopDeadlineRef.current;
      if (!savedDeadline) {
        void SecureStore.setItemAsync(`stop_timer_${barathon.id}_${activeStop.id}`, String(deadline)).catch(() => {});
      }

      setState((prev) => ({
        ...prev,
        phase: deadline <= now ? 'overtime' : 'in_stop',
        isInsideStopRadius: true,
        remainingSeconds: Math.max(0, Math.ceil((deadline - now) / 1000)),
      }));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      timerRef.current = setInterval(() => {
        const deadline = stopDeadlineRef.current;

        if (!deadline) {
          return;
        }

        const secondsLeft = Math.max(
          0,
          Math.ceil((deadline - Date.now()) / 1000)
        );

        if (secondsLeft <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          stopDeadlineRef.current = null;

          void cancelStopNotifications(notificationIdsRef.current);

          notificationIdsRef.current = {
            fiveMin: null,
            overtime: null,
          };

          setState((prev) => ({
            ...prev,
            remainingSeconds: 0,
            phase: 'overtime',
            isInsideStopRadius: true,
            fiveMinNotificationId: null,
            overtimeNotificationId: null,
          }));

          return;
        }

        setState((prev) => ({
          ...prev,
          remainingSeconds: secondsLeft,
          phase: 'in_stop',
          isInsideStopRadius: true,
        }));
      }, 1000);

      if (savedDeadline) return;

      // 2. Schedule push notifications asynchronously (isolated to prevent any failure from blocking timer)
      void (async () => {
        try {
          await cancelStopNotifications(notificationIdsRef.current);

          let fiveMinId: string | null = null;
          let overtimeId: string | null = null;

          if (maxBarSeconds >= 300) {
            const secondsUntilFiveMinutesLeft = maxBarSeconds - 300;
            fiveMinId = await scheduleFiveMinutesLeftNotification(
              activeStop.name,
              Math.max(1, secondsUntilFiveMinutesLeft)
            );
          }

          overtimeId = await scheduleOvertimeNotification(
            activeStop.name,
            maxBarSeconds
          );

          notificationIdsRef.current = {
            fiveMin: fiveMinId,
            overtime: overtimeId,
          };

          setState((prev) => ({
            ...prev,
            fiveMinNotificationId: fiveMinId,
            overtimeNotificationId: overtimeId,
          }));
        } catch (error) {
          console.warn('[useActiveBarathonTracking] Notification scheduling warning:', error);
        }
      })();
    }
  async function advanceToStop(targetIndex: number) {
    stopDeadlineRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await cancelStopNotifications(notificationIdsRef.current);

    notificationIdsRef.current = {
      fiveMin: null,
      overtime: null,
    };

    hasStartedTimerForCurrentStopRef.current = false;

    currentStopIdRef.current = barathon.stops[targetIndex]?.id ?? null;

    setState((prev) => {
      const hasTargetStop = targetIndex < barathon.stops.length;

      if (!hasTargetStop || targetIndex >= barathon.stops.length) {
        return {
          ...prev,
          activeStopIndex: Math.max(0, barathon.stops.length - 1),
          phase: 'finished',
          remainingSeconds: 0,
          isInsideStopRadius: false,
          fiveMinNotificationId: null,
          overtimeNotificationId: null,
        };
      }

      return {
        ...prev,
        activeStopIndex: targetIndex,
        phase: 'en_route',
        remainingSeconds: maxBarSeconds,
        isInsideStopRadius: false,
        fiveMinNotificationId: null,
        overtimeNotificationId: null,
      };
    });
  }

  async function goToNextStop() {
    stopDeadlineRef.current = null;
    if (activeStop && !activeStop.is_completed) {
      try {
        await completeBarathonStop(barathon.id, activeStop.id);
        onStopCompleted?.(activeStop.id);
      } catch (error) {
        console.error('[goToNextStop] Failed to complete stop:', error);
      }
    }

    await cancelStopNotifications(notificationIdsRef.current);

    notificationIdsRef.current = {
      fiveMin: null,
      overtime: null,
    };

    hasStartedTimerForCurrentStopRef.current = false;


    setState((prev) => {
      const nextIndex = prev.activeStopIndex + 1;
      const hasNextStop = nextIndex < barathon.stops.length;

      if (!hasNextStop) {
        return {
          ...prev,
          phase: 'finished',
          remainingSeconds: 0,
          isInsideStopRadius: false,
          fiveMinNotificationId: null,
          overtimeNotificationId: null,
        };
      }

      return {
        ...prev,
        activeStopIndex: nextIndex,
        phase: 'en_route',
        remainingSeconds: maxBarSeconds,
        isInsideStopRadius: false,
        fiveMinNotificationId: null,
        overtimeNotificationId: null,
      };
    });
  }

  async function stopTracking() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await cancelStopNotifications(notificationIdsRef.current);

    notificationIdsRef.current = {
      fiveMin: null,
      overtime: null,
    };

    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
  }

  async function openInGoogleMaps() {
    await openWalkingDirectionsInGoogleMaps(
      state.currentLocation,
      activeStopLocation
    );
  }

  return {
    state,
    activeStop,
    nextStop,
    distanceToActiveStopMeters,
    estimatedWalkMinutes,
    openInGoogleMaps,
    stopTracking,
    goToNextStop,
    advanceToStop,
    startStopTimer: () => { if (timerReady && activeStop && hydratedTimerKeyRef.current === `stop_timer_${barathon.id}_${activeStop.id}`) void startStopTimer(); },
  };
}
