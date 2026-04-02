import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { styles } from '../styles/createBarathon.styles';

type DateTimeModalFieldProps = {
  label: string;
  value: Date | null;
  onConfirm: (value: Date) => void;
  mode: 'date' | 'time';
  placeholder?: string;
};

export default function DateTimeModalField({
  label,
  value,
  onConfirm,
  mode,
  placeholder = 'Sélectionner',
}: DateTimeModalFieldProps) {
  const [visible, setVisible] = useState(false);
  const [tempValue, setTempValue] = useState<Date>(value ?? new Date());

  useEffect(() => {
    if (value) {
      setTempValue(value);
    }
  }, [value]);

  function openPicker() {
    setTempValue(value ?? new Date());
    setVisible(true);
  }

  function closePicker() {
    setVisible(false);
  }

  function handleConfirm() {
    onConfirm(tempValue);
    setVisible(false);
  }

  function formatDisplay(currentValue: Date | null) {
    if (!currentValue) {
      return placeholder;
    }

    if (mode === 'date') {
      return currentValue.toLocaleDateString('fr-FR');
    }

    return currentValue.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
    const today = new Date();
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.dateInputButton}
        onPress={openPicker}
        activeOpacity={0.85}
      >
        <Text style={styles.dateInputButtonText}>
          {formatDisplay(value)}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalCard}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={closePicker} style={styles.pickerHeaderButton}>
                <Text style={styles.pickerHeaderButtonText}>Annuler</Text>
              </TouchableOpacity>

              <Text style={styles.pickerModalTitle}>
                {mode === 'date' ? 'Choisir une date' : 'Choisir une heure'}
              </Text>

              <TouchableOpacity onPress={handleConfirm} style={styles.pickerHeaderButton}>
                <Text style={styles.pickerHeaderButtonText}>Valider</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerBody}>
              <DateTimePicker
                value={tempValue}
                mode={mode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setTempValue(selectedDate);
                  }
                }}
                minimumDate={mode === 'date' ? today : undefined}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
