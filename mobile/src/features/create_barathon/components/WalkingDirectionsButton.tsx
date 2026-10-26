import { Alert, Linking, Text, TouchableOpacity } from 'react-native';
import type { LatLng } from '../services/routing.service';
import { getWalkingDirectionsUrl } from '../services/mapLinks.service';

export default function WalkingDirectionsButton({ from, to }: { from: LatLng; to: LatLng }) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel="Ouvrir le trajet à pied dans Google Maps"
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
      onPress={async () => {
        const url = getWalkingDirectionsUrl(from, to);
        if (!url) return;
        try { await Linking.openURL(url); }
        catch { Alert.alert('Navigation', 'Impossible d’ouvrir Maps pour le moment.'); }
      }}
    >
      <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>À pied dans Maps ↗</Text>
    </TouchableOpacity>
  );
}
