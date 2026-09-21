import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

type Coordinates = {
  latitude: number;
  longitude: number;
};

// Module-level cache to eliminate delay when transitioning between screens
let globalCachedLocation: Coordinates | null = null;
let globalCachedHeading: number = 0;

export function useUserLocation() {
  const [location, setLocation] = useState<Coordinates | null>(globalCachedLocation);
  const [heading, setHeading] = useState<number>(globalCachedHeading);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(!globalCachedLocation);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    let mounted = true;

    async function startTracking() {
      try {
        if (!globalCachedLocation) {
          setLoadingLocation(true);
        }
        setLocationError(null);

        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (mounted) {
            setPermissionGranted(false);
            setLocationError('Permission de localisation refusée.');
            setLoadingLocation(false);
          }
          return;
        }

        if (mounted) {
          setPermissionGranted(true);
        }

        // 1. Instant fix: retrieve the OS cached position in < 15ms
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 180000, // Accepts cached location up to 3 mins old
          });
          if (lastKnown && mounted) {
            const coords: Coordinates = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            globalCachedLocation = coords;
            setLocation(coords);
            setLoadingLocation(false);
          }
        } catch {
          // Non-blocking fallback
        }

        // 2. High-speed fresh position using Balanced accuracy (cell + wifi + fast GPS)
        // This resolves in < 500ms instead of 10s with Accuracy.High
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then((current) => {
            if (!mounted) return;
            const coords: Coordinates = {
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            };
            globalCachedLocation = coords;
            setLocation(coords);
            setLoadingLocation(false);
          })
          .catch(() => {
            // Silently ignore if already loaded via lastKnown
          });

        // 3. Continuous position updates with balanced accuracy and smooth interval
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 2000,
            distanceInterval: 4,
          },
          (updatedLocation) => {
            if (!mounted) return;

            const coords: Coordinates = {
              latitude: updatedLocation.coords.latitude,
              longitude: updatedLocation.coords.longitude,
            };
            globalCachedLocation = coords;
            setLocation(coords);
            setLoadingLocation(false);
          }
        );

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          if (!mounted) return;

          if (typeof headingData.trueHeading === 'number' && headingData.trueHeading >= 0) {
            globalCachedHeading = headingData.trueHeading;
            setHeading(headingData.trueHeading);
            return;
          }

          if (typeof headingData.magHeading === 'number') {
            globalCachedHeading = headingData.magHeading;
            setHeading(headingData.magHeading);
          }
        });
      } catch (error) {
        if (mounted) {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'Impossible de récupérer la localisation.'
          );
          setLoadingLocation(false);
        }
      }
    }

    void startTracking();

    return () => {
      mounted = false;
      locationSubscription?.remove();
      headingSubscription?.remove();
    };
  }, []);

  return {
    location,
    heading,
    permissionGranted,
    loadingLocation,
    locationError,
  };
}
