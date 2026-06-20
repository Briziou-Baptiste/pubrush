import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

import { BarathonListItem } from '../types/barathon.types';
import { formatDate, formatTime } from '../utils/barathon.formatters';
import { formatBarathonStatus } from '../utils/barathon.status';
import { getStartGraceCountdown } from '../utils/barathon.countdown';
import { styles } from '../styles/barathonCards.styles';
import StartBarathonSlider from './StartBarathonSlider';

type BarathonCardProps = {
  item: BarathonListItem;
  variant: 'planned' | 'past';
  currentUserId: number;
  onChangeStartTime?: (item: BarathonListItem) => void;
  onAddParticipants?: (item: BarathonListItem) => void;
  onDelete?: (item: BarathonListItem) => void;
  onInfo?: (item: BarathonListItem) => void;
  isDeleting?: boolean;
    onStart?: (item: BarathonListItem) => void;
};

export default function BarathonCard({
  item,
  variant,
  currentUserId,
  onChangeStartTime,
  onAddParticipants,
  onDelete,
  onInfo,
  isDeleting = false,
    onStart,
}: BarathonCardProps) {
  const isCreator =
    item.current_user_role === 'creator' ||
    item.created_by_user_id === currentUserId;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (variant !== 'planned') {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [variant]);

  const countdown = useMemo(() => {
    return getStartGraceCountdown(item.start_datetime, now);
  }, [item.start_datetime, now]);

  const roleLabel = isCreator ? 'Créateur' : 'Rejoint';

    const pastStatusLabel =
      item.status === 'completed'
        ? 'Terminé avec succès'
        : item.status === 'cancelled'
        ? 'Annulé'
        : 'Mission failed';

    const pastStatusStyle =
      item.status === 'completed'
        ? styles.statusBadgeSuccess
        : item.status === 'cancelled'
        ? styles.statusBadgeCancelled
        : styles.statusBadgeFailed;

    const pastStatusTextStyle =
      item.status === 'completed'
        ? styles.statusBadgeSuccessText
        : item.status === 'cancelled'
        ? styles.statusBadgeCancelledText
        : styles.statusBadgeFailedText;

  const countdownStyle =
    countdown.level === 'danger'
      ? styles.countdownDanger
      : countdown.level === 'warning'
      ? styles.countdownWarning
      : styles.countdownNormal;

  const countdownTextStyle =
    countdown.level === 'danger'
      ? styles.countdownDangerText
      : countdown.level === 'warning'
      ? styles.countdownWarningText
      : styles.countdownNormalText;

  return (
    <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{item.name}</Text>

              <View style={styles.badgesRow}>
                <View
                  style={[
                    styles.roleBadge,
                    isCreator ? styles.roleBadgeCreator : styles.roleBadgeParticipant,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      isCreator
                        ? styles.roleBadgeTextCreator
                        : styles.roleBadgeTextParticipant,
                    ]}
                  >
                    {roleLabel}
                  </Text>
                </View>

                {variant === 'past' ? (
                  <View style={[styles.statusBadge, pastStatusStyle]}>
                    <Text style={[styles.statusBadgeText, pastStatusTextStyle]}>
                      {pastStatusLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          {onInfo ? (
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => onInfo(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.infoButtonText}>i</Text>
            </TouchableOpacity>
          ) : null}
          </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Date de début</Text>
          <Text style={styles.infoValue}>{formatDate(item.start_datetime)}</Text>
        </View>

          {variant === 'planned' ? (
            <TouchableOpacity
              style={[styles.infoBlock, styles.infoBlockPressable]}
              onPress={() => onChangeStartTime?.(item)}
              activeOpacity={0.85}
              disabled={isDeleting}
            >
              <Text style={styles.infoLabel}>Heure de début</Text>
              <Text style={styles.infoValue}>{formatTime(item.start_datetime)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Heure de début</Text>
              <Text style={styles.infoValue}>{formatTime(item.start_datetime)}</Text>
            </View>
          )}
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Temps de trajet</Text>
          <Text style={styles.infoValue}>
            {item.travel_time_between_bars_minutes} min
          </Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Temps max bar</Text>
          <Text style={styles.infoValue}>
            {item.max_time_in_bar_minutes} min
          </Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Nombre de stops</Text>
          <Text style={styles.infoValue}>{item.stops.length}</Text>
        </View>

        {variant === 'planned' ? (
          <TouchableOpacity
            style={[styles.infoBlock, styles.infoBlockPressable]}
            onPress={() => onAddParticipants?.(item)}
            activeOpacity={0.85}
            disabled={isDeleting}
          >
            <Text style={styles.infoLabel}>Participants</Text>
            <Text style={styles.infoValue}>{item.participants_count}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Participants</Text>
            <Text style={styles.infoValue}>{item.participants_count}</Text>
          </View>
        )}
      </View>

      {variant === 'planned' && countdown.visible ? (
        <View style={[styles.countdownBox, countdownStyle]}>
          <Text style={[styles.countdownLabel, countdownTextStyle]}>
            {countdown.title}
          </Text>
          <Text style={[styles.countdownValue, countdownTextStyle]}>
            {countdown.label}
          </Text>
        </View>
      ) : null}

      {variant === 'planned' && isCreator ? (
        <View style={styles.actionsColumn}>
             <StartBarathonSlider
               disabled={isDeleting}
               onComplete={() => onStart?.(item)}
             />
          <TouchableOpacity
            style={[
              styles.deleteActionButton,
              isDeleting ? styles.actionButtonDisabled : null,
            ]}
            onPress={() => onDelete?.(item)}
            activeOpacity={0.85}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <View style={styles.deleteLoadingRow}>
                <ActivityIndicator size="small" />
                <Text style={styles.deleteActionButtonText}>
                  Suppression...
                </Text>
              </View>
            ) : (
              <Text style={styles.deleteActionButtonText}>
                Supprimer le barathon
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
