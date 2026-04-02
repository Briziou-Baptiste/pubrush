import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/home.styles';

type LocationButtonProps = {
  onPress: () => void;
  heading?: number;
  disabled?: boolean;
};

export default function LocationButton({
  onPress,
  heading = 0,
  disabled = false,
}: LocationButtonProps) {
  const safeHeading =
    typeof heading === 'number' && Number.isFinite(heading)
      ? ((heading % 360) + 360) % 360
      : 0;

  return (
    <View style={styles.locationControlShell}>
      <TouchableOpacity
        style={[
          styles.locationControlButton,
          disabled ? styles.locationControlButtonDisabled : null,
        ]}
        onPress={onPress}
        activeOpacity={0.85}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Recentrer la carte sur ma position"
      >
        <View
          style={{
            transform: [{ rotate: `${safeHeading}deg` }],
          }}
        >
          <Ionicons name="navigate" size={20} color="#111827" />
        </View>
      </TouchableOpacity>
    </View>
  );
}
