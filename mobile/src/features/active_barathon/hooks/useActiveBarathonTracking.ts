import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';

import {
  ActiveBarathonData,
  ActiveBarathonState,
  ActiveBarathonStop,
  LatLng,
} from '../types/activeBarathon.types';
import { completeBarathonStop } from '../services/activeBarathon.service';
import { getDistanceMeters, isWithinStopRadius } from '../utils/activeBarathon.distance';
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
};

export function useActiveBarathonTracking({ barathon }: Params) {
  const maxBarSeconds = useMemo(
    () => secondsFromMinutes(barathon.max_time_in_bar_minutes),
    [barathon.max_time_in_bar_minutes]
  );

  const [state, setState] = useState<ActiveBarathonState>({
    activeStopIndex: 0,
    phase: 'en_route',
    currentLocation: null,
    visitedPath: [],
    remainingSeconds: maxBarSeconds,
    isInsideStopRadius: false,
    fiveMinNotificationId: null,
    overtimeNotificationId: null,
  });

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

  useEffect(() => {
    void ensureNotificationPermissions();
    void startLocationTracking();

    return () => {
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

    hasStartedTimerForCurrentStopRef.current = false;
    currentStopIdRef.current = barathon.stops[0]?.id ?? null;

    setState((prev) => ({
      ...prev,
      activeStopIndex: 0,
      phase: 'en_route',
      remainingSeconds: maxBarSeconds,
      isInsideStopRadius: false,
      fiveMinNotificationId: null,
      overtimeNotificationId: null,
    }));
  }, [barathon.id, barathon.stops.length, maxBarSeconds]);

  useEffect(() => {
    if (!activeStop) {
      return;
    }

    if (currentStopIdRef.current !== activeStop.id) {
      currentStopIdRef.current = activeStop.id;
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
    if (!activeStop) {
      return;
    }

    const isInside = isWithinStopRadius(
      state.currentLocation,
      activeStopLocation,
      10
    );

    if (isInside && !state.isInsideStopRadius && !hasStartedTimerForCurrentStopRef.current) {
      void startStopTimer();
      return;
    }

    if (!isInside && hasStartedTimerForCurrentStopRef.current) {
      void resetStopTimerAndGoBackToRoute();
    }
  }, [
    state.currentLocation,
    activeStopLocation,
    state.isInsideStopRadius,
    activeStop?.id,
  ]);

  async function startLocationTracking() {
    if (locationSubscriptionRef.current) {
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
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
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        console.log('WATCH POSITION EVENT', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });

        const newPosition = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setState((prev) => ({
          ...prev,
          currentLocation: newPosition,
          visitedPath: [...prev.visitedPath, newPosition],
        }));
      }
    );
  }

  async function startStopTimer() {
    if (!activeStop) {
      return;
    }
      await completeBarathonStop(barathon.id, activeStop.id);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    hasStartedTimerForCurrentStopRef.current = true;

    let fiveMinId: string | null = null;
    let overtimeId: string | null = null;

    if (maxBarSeconds > 300) {
      fiveMinId = await scheduleFiveMinutesLeftNotification(
        activeStop.name,
        maxBarSeconds - 300
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
      phase: 'in_stop',
      isInsideStopRadius: true,
      remainingSeconds: maxBarSeconds,
      fiveMinNotificationId: fiveMinId,
      overtimeNotificationId: overtimeId,
    }));

    timerRef.current = setInterval(() => {
      setState((prev) => {
        const nextRemaining = prev.remainingSeconds - 1;

        if (nextRemaining <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          void moveToNextStopAutomatically();

          return {
            ...prev,
            remainingSeconds: 0,
            phase: 'overtime',
            isInsideStopRadius: true,
          };
        }

        return {
          ...prev,
          remainingSeconds: nextRemaining,
          phase: 'in_stop',
          isInsideStopRadius: true,
        };
      });
    }, 1000);
  }

  async function resetStopTimerAndGoBackToRoute() {
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

    setState((prev) => ({
      ...prev,
      phase: 'en_route',
      remainingSeconds: maxBarSeconds,
      isInsideStopRadius: false,
      fiveMinNotificationId: null,
      overtimeNotificationId: null,
    }));
  }

  async function moveToNextStopAutomatically() {
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
    openInGoogleMaps,
    stopTracking,
  };
}
