import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../styles/activeBarathon.styles';
import { formatRemainingTime, getTimerTone } from '../utils/activeBarathon.timer';

type Props = {
  title: string;
  stepLabel: string;
  phaseLabel: string;
  remainingSeconds: number;
    onStopPress?: () => void;
};

export default function ActiveBarathonHeader({
  title,
  stepLabel,
  phaseLabel,
  remainingSeconds,
  onStopPress,
}: Props) {
  const tone = getTimerTone(remainingSeconds);

  return (
    <View style={styles.headerCard}>
      {/* Ligne du haut */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{stepLabel}</Text>
          <Text style={styles.phaseText}>{phaseLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          activeOpacity={0.85}
          onPress={onStopPress}
        >
          <Text style={styles.stopButtonText}>Arrêter</Text>
        </TouchableOpacity>
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
