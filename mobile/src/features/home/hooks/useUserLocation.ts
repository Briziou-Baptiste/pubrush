import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const LOCATION_CACHE_KEY = 'pubrush_last_location';

// Module-level cache to eliminate delay when transitioning between screens
export let globalCachedLocation: Coordinates | null = null;
let globalCachedHeading: number = 0;

/**
 * Proactively initialize location from persistent cache and warm up GPS
 * Called directly at root layout level for < 50ms perceived startup
 */
export async function initializeLocationCache(): Promise<Coordinates | null> {
  try {
    const cached = await SecureStore.getItemAsync(LOCATION_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Valid for up to 2 hours
      if (Date.now() - parsed.timestamp < 7200000) {
        globalCachedLocation = {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        };
      }
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 120000, // 2 minutes
      });
      if (lastKnown) {
        const coords: Coordinates = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        globalCachedLocation = coords;
        void SecureStore.setItemAsync(
          LOCATION_CACHE_KEY,
          JSON.stringify({ ...coords, timestamp: Date.now() })
        );
        return coords;
      }
    }
  } catch (err) {
    console.warn('[initializeLocationCache] Error:', err);
  }
  return globalCachedLocation;
}

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
            maxAge: 60000, // Fresh within 1 min
          });
          if (lastKnown && mounted) {
            const coords: Coordinates = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            globalCachedLocation = coords;
            setLocation(coords);
            setLoadingLocation(false);
            void SecureStore.setItemAsync(
              LOCATION_CACHE_KEY,
              JSON.stringify({ ...coords, timestamp: Date.now() })
            );
          }
        } catch {
          // Non-blocking fallback
        }

        // 2. High-accuracy fresh position
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
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
            void SecureStore.setItemAsync(
              LOCATION_CACHE_KEY,
              JSON.stringify({ ...coords, timestamp: Date.now() })
            );
          })
          .catch(() => {
            // Silently ignore if already loaded via lastKnown
          });

        // 3. Continuous position updates with High accuracy for sharp map centering
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
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
            void SecureStore.setItemAsync(
              LOCATION_CACHE_KEY,
              JSON.stringify({ ...coords, timestamp: Date.now() })
            );
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
