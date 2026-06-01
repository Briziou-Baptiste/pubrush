import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../styles/activeBarathon.styles';

type Props = {
  stopName: string;
  distanceLabel: string;
  onOpenGoogleMaps: () => void;
  onNextStep?: () => void;
  isLastStop?: boolean;
  isInsideStop?: boolean;
};

export default function ActiveBarathonBottomPanel({
  stopName,
  distanceLabel,
  onOpenGoogleMaps,
  onNextStep,
  isLastStop = false,
  isInsideStop = false,
}: Props) {
  return (
    <View style={styles.panelCard}>
      <Text style={styles.panelTitle}>
        {isInsideStop ? 'Étape actuelle' : 'Prochain arrêt'}
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Nom</Text>
        <Text style={styles.value}>{stopName}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.value}>{distanceLabel}</Text>
      </View>

      <TouchableOpacity style={styles.googleMapsButton} onPress={onOpenGoogleMaps} activeOpacity={0.85}>
        <Text style={styles.googleMapsButtonText}>Ouvrir Google Maps</Text>
      </TouchableOpacity>

      {onNextStep && (
        <TouchableOpacity style={styles.nextStepButton} onPress={onNextStep} activeOpacity={0.85}>
          <Text style={styles.nextStepButtonText}>
            {isLastStop ? 'Terminer le barathon' : "Passer à l'étape suivante"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
