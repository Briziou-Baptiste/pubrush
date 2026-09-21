import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/activeBarathon.styles';

type Props = {
  stopName: string;
  stopType?: 'bar' | 'food';
  distanceLabel: string;
  estimatedMinutes?: number | null;
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
  stopType = 'bar',
  distanceLabel,
  estimatedMinutes,
  onOpenGoogleMaps,
  onNextStep,
  onReplacePress,
  onAddStopPress,
  isMaitreDuTrajet = false,
  isLastStop = false,
  isInsideStop = false,
}: Props) {
  function handleSecureNextStep() {
    if (isLastStop) {
      onNextStep?.();
      return;
    }

    Alert.alert(
      'Étape suivante',
      `Confirmez-vous le départ vers la prochaine étape ? L'étape "${stopName}" sera marquée comme terminée pour l'ensemble du groupe.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'default',
          onPress: () => {
            onNextStep?.();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.panelCard}>
      {/* En-tête compact : Statut & Type */}
      <View style={styles.compactPanelHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isInsideStop ? 'Étape actuelle' : 'Prochain arrêt'}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 1 }} numberOfLines={1}>
            {stopName}
          </Text>
        </View>

        <View style={styles.compactCategoryBadge}>
          <Ionicons
            name={stopType === 'bar' ? 'beer' : 'restaurant'}
            size={13}
            color={stopType === 'bar' ? '#D97706' : '#2563EB'}
          />
          <Text style={styles.compactCategoryText}>
            {stopType === 'bar' ? 'Bar' : 'Restaurant'}
          </Text>
        </View>
      </View>

      {/* Métriques : Distance & Temps de marche estimé */}
      <View style={styles.compactMetricsRow}>
        <View style={styles.compactMetricChip}>
          <Ionicons name="location-outline" size={14} color="#2563EB" />
          <Text style={styles.compactMetricText}>{distanceLabel}</Text>
        </View>

        {estimatedMinutes !== undefined && estimatedMinutes !== null && (
          <View style={styles.compactMetricChip}>
            <Ionicons name="walk-outline" size={14} color="#16A34A" />
            <Text style={[styles.compactMetricText, { color: '#15803D' }]}>
              ~{estimatedMinutes} min à pied
            </Text>
          </View>
        )}
      </View>

      {/* Actions secondaires rapides (Itinéraire, Remplacer, Ajouter) */}
      <View style={styles.compactActionsRow}>
        <TouchableOpacity
          style={styles.compactActionChip}
          onPress={onOpenGoogleMaps}
          activeOpacity={0.75}
        >
          <Ionicons name="navigate-circle-outline" size={16} color="#111827" />
          <Text style={styles.compactActionChipText}>Itinéraire</Text>
        </TouchableOpacity>

        {isMaitreDuTrajet && onReplacePress && (
          <TouchableOpacity
            style={[styles.compactActionChip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
            onPress={onReplacePress}
            activeOpacity={0.75}
          >
            <Ionicons name="swap-horizontal" size={15} color="#C2410C" />
            <Text style={[styles.compactActionChipText, { color: '#C2410C' }]}>Remplacer</Text>
          </TouchableOpacity>
        )}

        {isMaitreDuTrajet && onAddStopPress && (
          <TouchableOpacity
            style={[styles.compactActionChip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
            onPress={onAddStopPress}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={16} color="#1D4ED8" />
            <Text style={[styles.compactActionChipText, { color: '#1D4ED8' }]}>Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bouton principal sécurisé d'avancement d'étape */}
      {onNextStep && (
        <TouchableOpacity
          style={[
            styles.safeNextStepButton,
            isLastStop && { backgroundColor: '#DC2626', shadowColor: '#DC2626' },
          ]}
          onPress={handleSecureNextStep}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isLastStop ? 'flag' : 'arrow-forward-circle'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.safeNextStepButtonText}>
            {isLastStop ? 'Terminer le barathon' : "Passer à l'étape suivante"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
