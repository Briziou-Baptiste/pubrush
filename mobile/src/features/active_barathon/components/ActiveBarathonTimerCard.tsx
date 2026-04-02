import { Text, View } from 'react-native';

import { formatRemainingTime, getTimerTone } from '../utils/activeBarathon.timer';
import { styles } from '../styles/activeBarathon.styles';

type Props = {
  remainingSeconds: number;
};

export default function ActiveBarathonTimerCard({ remainingSeconds }: Props) {
  const tone = getTimerTone(remainingSeconds);

  return (
    <View style={styles.panelCard}>
      <Text style={styles.panelTitle}>Chrono bar</Text>
      <Text
        style={[
          styles.timerValue,
          tone === 'normal'
            ? styles.timerNormal
            : tone === 'warning'
            ? styles.timerWarning
            : styles.timerDanger,
        ]}
      >
        {formatRemainingTime(remainingSeconds)}
      </Text>
    </View>
  );
}
