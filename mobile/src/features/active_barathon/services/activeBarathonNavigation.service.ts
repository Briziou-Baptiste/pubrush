import { Alert, Linking } from 'react-native';

import { LatLng } from '../types/activeBarathon.types';
import { getWalkingDirectionsUrl } from '../../create_barathon/services/mapLinks.service';

export async function openWalkingDirectionsInGoogleMaps(
  origin: LatLng | null,
  destination: LatLng | null
) {
  const url = getWalkingDirectionsUrl(origin, destination);
  if (!url) {
    Alert.alert('Navigation', 'Destination ou coordonnées indisponibles.');
    return;
  }

  try { await Linking.openURL(url); }
  catch { Alert.alert('Navigation', 'Impossible d’ouvrir Google Maps pour le moment.'); }
}
