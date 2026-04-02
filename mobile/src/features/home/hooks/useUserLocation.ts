import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function useUserLocation() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    let mounted = true;

    async function startTracking() {
      try {
        setLoadingLocation(true);
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

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (mounted) {
          setLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
          setLoadingLocation(false);
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (updatedLocation) => {
            if (!mounted) return;

            setLocation({
              latitude: updatedLocation.coords.latitude,
              longitude: updatedLocation.coords.longitude,
            });
          }
        );

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          if (!mounted) return;

          if (typeof headingData.trueHeading === 'number' && headingData.trueHeading >= 0) {
            setHeading(headingData.trueHeading);
            return;
          }

          if (typeof headingData.magHeading === 'number') {
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

    startTracking();

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
