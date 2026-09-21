import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/activeBarathon.styles';
import { formatRemainingTime, getTimerTone } from '../utils/activeBarathon.timer';

type Props = {
  title: string;
  stepLabel: string;
  phaseLabel: string;
  remainingSeconds: number;
  onStopPress?: () => void;
  onExpensesPress?: () => void;
  onRolesPress?: () => void;
  onInvitePress?: () => void;
  isSousSolMode?: boolean;
  onSousSolPress?: () => void;
};

export default function ActiveBarathonHeader({
  title,
  stepLabel,
  phaseLabel,
  remainingSeconds,
  onStopPress,
  onExpensesPress,
  onRolesPress,
  onInvitePress,
  isSousSolMode,
  onSousSolPress,
}: Props) {
  const tone = getTimerTone(remainingSeconds);

  return (
    <View style={styles.headerCard}>
      {/* Ligne du haut */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{stepLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Text style={[styles.phaseText, { marginTop: 0 }]}>{phaseLabel}</Text>
            {isSousSolMode && (
              <TouchableOpacity
                style={[styles.offlineBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                activeOpacity={0.8}
                onPress={
                  onSousSolPress ||
                  (() => {
                    Alert.alert(
                      'Mode Sous-sol Actif',
                      'Pas de réseau 4G détecté (cave ou sous-sol). Tes actions et le chrono continuent en local et seront synchronisés automatiquement à la sortie !'
                    );
                  })
                }
              >
                <Ionicons name="flashlight-outline" size={13} color="#D97706" />
                <Text style={styles.offlineBadgeText}>Sous-sol</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'stretch', gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onInvitePress && (
              <TouchableOpacity
                style={[styles.rolesButton, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                activeOpacity={0.85}
                onPress={onInvitePress}
              >
                <Ionicons name="qr-code-outline" size={14} color="#FFFFFF" />
                <Text style={styles.rolesButtonText}>Inviter</Text>
              </TouchableOpacity>
            )}

            {onRolesPress && (
              <TouchableOpacity
                style={[styles.rolesButton, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                activeOpacity={0.85}
                onPress={onRolesPress}
              >
                <Ionicons name="ribbon-outline" size={14} color="#FFFFFF" />
                <Text style={styles.rolesButtonText}>Rôles</Text>
              </TouchableOpacity>
            )}

            {onStopPress && (
              <TouchableOpacity
                style={styles.stopButton}
                activeOpacity={0.85}
                onPress={onStopPress}
              >
                <Text style={styles.stopButtonText}>Arrêter</Text>
              </TouchableOpacity>
            )}
          </View>

          {onExpensesPress && (
            <TouchableOpacity
              style={[styles.expensesButton, { marginTop: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              activeOpacity={0.85}
              onPress={onExpensesPress}
            >
              <Ionicons name="wallet-outline" size={15} color="#FFFFFF" />
              <Text style={styles.expensesButtonText}>Comptes</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chrono */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>Chrono bar</Text>

        <Text
          style={[
            styles.timerValue,
            tone === 'normal'
              ? styles.timerGreen
              : tone === 'warning'
              ? styles.timerOrange
              : styles.timerRed,
          ]}
        >
          {formatRemainingTime(remainingSeconds)}
        </Text>
      </View>
    </View>
  );
}
