import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../styles/activeBarathon.styles';

type Props = {
  stopName: string;
  distanceLabel: string;
  onOpenGoogleMaps: () => void;
};

export default function ActiveBarathonBottomPanel({
  stopName,
  distanceLabel,
  onOpenGoogleMaps,
}: Props) {
  return (
    <View style={styles.panelCard}>
      <Text style={styles.panelTitle}>Prochain arrêt</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Nom</Text>
        <Text style={styles.value}>{stopName}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.value}>{distanceLabel}</Text>
      </View>

      <TouchableOpacity style={styles.googleMapsButton} onPress={onOpenGoogleMaps}>
        <Text style={styles.googleMapsButtonText}>Ouvrir Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
}
