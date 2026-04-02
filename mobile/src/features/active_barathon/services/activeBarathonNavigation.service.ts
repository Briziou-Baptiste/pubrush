import { Alert, Linking } from 'react-native';

import { LatLng } from '../types/activeBarathon.types';

export async function openWalkingDirectionsInGoogleMaps(
  origin: LatLng | null,
  destination: LatLng | null
) {
  if (!origin || !destination) {
    Alert.alert('Erreur', 'Origine ou destination indisponible.');
    return;
  }

  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&travelmode=walking`;

  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    Alert.alert('Erreur', 'Impossible d’ouvrir Google Maps.');
    return;
  }

  await Linking.openURL(url);
}
