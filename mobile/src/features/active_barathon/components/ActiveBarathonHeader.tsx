import { memo } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/activeBarathon.styles';
import { formatRemainingTime, getTimerTone } from '../utils/activeBarathon.timer';

type Props = {
  title: string;
  stepLabel: string;
  phaseLabel: string;
  remainingSeconds: number;
  totalBarSeconds?: number;
  onStopPress?: () => void;
  onExpensesPress?: () => void;
  onRolesPress?: () => void;
  onInvitePress?: () => void;
  onPhotoPress?: () => void;
  photoPendingCount?: number;
  onTimerPress?: () => void;
  isSousSolMode?: boolean;
  onSousSolPress?: () => void;
  pendingOfflineActionsCount?: number;
};

function ActiveBarathonHeader({
  title,
  stepLabel,
  phaseLabel,
  remainingSeconds,
  totalBarSeconds,
  onStopPress,
  onExpensesPress,
  onRolesPress,
  onInvitePress,
  onPhotoPress,
  photoPendingCount = 0,
  onTimerPress,
  isSousSolMode,
  onSousSolPress,
  pendingOfflineActionsCount = 0,
}: Props) {
  const tone = getTimerTone(remainingSeconds);

  // Calculate percentage of time elapsed in bar
  const progressPercent =
    totalBarSeconds && totalBarSeconds > 0
      ? Math.max(0, Math.min(100, Math.round((remainingSeconds / totalBarSeconds) * 100)))
      : 100;

  return (
    <View style={styles.headerCard}>
      {/* Ligne du haut : Titre + Actions */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{stepLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
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
                      `Pas de réseau 4G détecté (cave ou sous-sol). Tes actions (${pendingOfflineActionsCount} enregistrée(s)) et le chrono continuent en local et seront synchronisés automatiquement à la sortie !`
                    );
                  })
                }
              >
                <Ionicons name="flashlight-outline" size={13} color="#D97706" />
                <Text style={styles.offlineBadgeText}>
                  Sous-sol{pendingOfflineActionsCount > 0 ? ` (${pendingOfflineActionsCount})` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Boutons d'action en haut à droite */}
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          {/* Bouton sécurisé Arrêter isolé */}
          {onStopPress && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#FEE2E2',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
              activeOpacity={0.8}
              onPress={onStopPress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="power-outline" size={13} color="#DC2626" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Quitter</Text>
            </TouchableOpacity>
          )}

          {/* Boutons d'équipe compacts */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onPhotoPress && (
              <TouchableOpacity
                style={[
                  styles.rolesButton,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    backgroundColor: '#0EA5E9',
                    position: 'relative',
                  },
                ]}
                activeOpacity={0.85}
                onPress={onPhotoPress}
              >
                <Ionicons name="camera-outline" size={13} color="#FFFFFF" />
                <Text style={[styles.rolesButtonText, { fontSize: 12 }]}>Photo</Text>
                {photoPendingCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      backgroundColor: '#EF4444',
                      borderRadius: 9,
                      minWidth: 18,
                      height: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      borderWidth: 1.5,
                      borderColor: '#FFFFFF',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                      {photoPendingCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {onInvitePress && (
              <TouchableOpacity
                style={[styles.rolesButton, { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7 }]}
                activeOpacity={0.85}
                onPress={onInvitePress}
              >
                <Ionicons name="qr-code-outline" size={13} color="#FFFFFF" />
                <Text style={[styles.rolesButtonText, { fontSize: 12 }]}>Inviter</Text>
              </TouchableOpacity>
            )}

            {onRolesPress && (
              <TouchableOpacity
                style={[styles.rolesButton, { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#7C3AED' }]}
                activeOpacity={0.85}
                onPress={onRolesPress}
              >
                <Ionicons name="ribbon-outline" size={13} color="#FFFFFF" />
                <Text style={[styles.rolesButtonText, { fontSize: 12 }]}>Rôles</Text>
              </TouchableOpacity>
            )}

            {onExpensesPress && (
              <TouchableOpacity
                style={[styles.expensesButton, { marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7 }]}
                activeOpacity={0.85}
                onPress={onExpensesPress}
              >
                <Ionicons name="wallet-outline" size={13} color="#FFFFFF" />
                <Text style={[styles.expensesButtonText, { fontSize: 12 }]}>Comptes</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Chrono avec jauge de progression visuelle */}
      <TouchableOpacity
        style={styles.timerContainer}
        activeOpacity={onTimerPress ? 0.75 : 1}
        onPress={onTimerPress}
        disabled={!onTimerPress}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
            {onTimerPress && (
              <Ionicons name="play-circle" size={16} color="#2563EB" />
            )}
            <Text style={styles.timerLabel} numberOfLines={1}>
              {onTimerPress ? 'Chrono en attente (toucher pour lancer)' : 'Temps restant au bar'}
            </Text>
          </View>
          <Text
            style={[
              { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
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

        {/* Barre de progression visuelle */}
        <View style={styles.timerProgressTrack}>
          <View
            style={[
              styles.timerProgressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor:
                  tone === 'normal'
                    ? '#22C55E'
                    : tone === 'warning'
                    ? '#F59E0B'
                    : '#EF4444',
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default memo(ActiveBarathonHeader);
