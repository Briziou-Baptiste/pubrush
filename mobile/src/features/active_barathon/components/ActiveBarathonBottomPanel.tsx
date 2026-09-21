import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../styles/activeBarathon.styles';

type Props = {
  stopName: string;
  distanceLabel: string;
  onOpenGoogleMaps: () => void;
  onNextStep?: () => void;
  onReplacePress?: () => void;
  onAddStopPress?: () => void;
  isMaitreDuTrajet?: boolean;
  isLastStop?: boolean;
  isInsideStop?: boolean;
};

export default function ActiveBarathonBottomPanel({
  stopName,
  distanceLabel,
  onOpenGoogleMaps,
  onNextStep,
  onReplacePress,
  onAddStopPress,
  isMaitreDuTrajet = false,
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

      {isMaitreDuTrajet && (onReplacePress || onAddStopPress) && (
        <View style={styles.trajetActionsRow}>
          {onReplacePress && (
            <TouchableOpacity
              style={styles.trajetReplaceButton}
              onPress={onReplacePress}
              activeOpacity={0.8}
            >
              <Text style={styles.trajetReplaceButtonText}>🔄 Remplacer</Text>
            </TouchableOpacity>
          )}

          {onAddStopPress && (
            <TouchableOpacity
              style={styles.trajetAddButton}
              onPress={onAddStopPress}
              activeOpacity={0.8}
            >
              <Text style={styles.trajetAddButtonText}>➕ Ajouter un bar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
