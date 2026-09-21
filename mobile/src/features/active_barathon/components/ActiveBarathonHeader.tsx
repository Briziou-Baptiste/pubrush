import { Alert, Text, TouchableOpacity, View } from 'react-native';

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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{stepLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Text style={[styles.phaseText, { marginTop: 0 }]}>{phaseLabel}</Text>
            {isSousSolMode && (
              <TouchableOpacity
                style={styles.offlineBadge}
                activeOpacity={0.8}
                onPress={
                  onSousSolPress ||
                  (() => {
                    Alert.alert(
                      'Mode Sous-sol Actif 🔦',
                      'Pas de réseau 4G détecté (cave ou sous-sol). Tes actions et le chrono continuent en local et seront synchronisés automatiquement à la sortie !'
                    );
                  })
                }
              >
                <Text style={styles.offlineBadgeText}>🔦 Sous-sol</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'stretch', gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onInvitePress && (
              <TouchableOpacity
                style={styles.rolesButton}
                activeOpacity={0.85}
                onPress={onInvitePress}
              >
                <Text style={styles.rolesButtonText}>🎟️ Inviter</Text>
              </TouchableOpacity>
            )}

            {onRolesPress && (
              <TouchableOpacity
                style={styles.rolesButton}
                activeOpacity={0.85}
                onPress={onRolesPress}
              >
                <Text style={styles.rolesButtonText}>👑 Rôles</Text>
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
              style={[styles.expensesButton, { marginTop: 0 }]}
              activeOpacity={0.85}
              onPress={onExpensesPress}
            >
              <Text style={styles.expensesButtonText}>💰 Comptes</Text>
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
