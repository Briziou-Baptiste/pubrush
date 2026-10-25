import { Linking, Text } from 'react-native';

export default function RoutingAttribution() {
  return (
    <Text style={{ fontSize: 10, color: '#6B7280', backgroundColor: '#FFFFFF', padding: 5 }}>
      Plein : piéton calculé · Pointillés : vol d’oiseau · Sans trait : trajet indisponible{'\n'}
      <Text onPress={() => void Linking.openURL('https://routing.openstreetmap.de/about.html')}>Routage OSRM / FOSSGIS</Text>
      {' · '}<Text onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap contributors (ODbL)</Text>
      {' · '}<Text onPress={() => void Linking.openURL('https://www.openstreetmap.org/fixthemap')}>Corriger la carte</Text>
    </Text>
  );
}
