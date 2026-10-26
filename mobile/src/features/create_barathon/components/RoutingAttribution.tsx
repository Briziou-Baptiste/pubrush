import { Linking, Text } from 'react-native';
import { WALKING_ROUTING_ENABLED } from '../services/routing.service';

export default function RoutingAttribution() {
  return (
    <Text style={{ fontSize: 10, color: '#4B5563', paddingVertical: 3, textAlign: 'center' }}>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap contributors · ODbL</Text>
      {WALKING_ROUTING_ENABLED && <Text onPress={() => void Linking.openURL('https://routing.openstreetmap.de/about.html')}>{' · OSRM / FOSSGIS'}</Text>}
      {' · '}<Text onPress={() => void Linking.openURL('https://www.openstreetmap.org/fixthemap')}>Corriger la carte</Text>
    </Text>
  );
}
