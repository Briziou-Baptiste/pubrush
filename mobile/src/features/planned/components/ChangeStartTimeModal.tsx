import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';
import { styles } from '../styles/changeStartTimeModal.styles';

type ChangeStartTimeModalProps = {
  visible: boolean;
  barathon: BarathonListItem | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (newDate: Date) => Promise<void>;
};

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ChangeStartTimeModal({
  visible,
  barathon,
  loading = false,
  onClose,
  onConfirm,
}: ChangeStartTimeModalProps) {
  const initialDate = useMemo(() => {
    if (!barathon) {
      return new Date();
    }

    return new Date(barathon.start_datetime);
  }, [barathon]);

  const [tempDate, setTempDate] = useState<Date>(initialDate);

  useEffect(() => {
    setTempDate(initialDate);
  }, [initialDate, visible]);

  function handlePickerChange(_: DateTimePickerEvent, selectedDate?: Date) {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  }

  function validateSelectedTime() {
    if (!barathon) {
      return { valid: false, message: 'Barathon introuvable.' };
    }

    const now = new Date();
    const originalDate = new Date(barathon.start_datetime);

    if (isSameLocalDay(originalDate, now) && tempDate.getTime() < now.getTime()) {
      return {
        valid: false,
        message:
          "Pour un barathon prévu aujourd'hui, la nouvelle heure ne peut pas être inférieure à l'heure actuelle.",
      };
    }

    return { valid: true };
  }

  function handleConfirmPress() {
    const validation = validateSelectedTime();

    if (!validation.valid) {
      Alert.alert('Heure invalide', validation.message);
      return;
    }

    Alert.alert(
      'Confirmer la modification',
      `Remplacer l'heure de début par ${tempDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Valider',
          onPress: async () => {
            await onConfirm(tempDate);
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Changer l'heure</Text>

          {barathon ? (
            <>
              <Text style={styles.subtitle}>{barathon.name}</Text>

              <Text style={styles.currentText}>
                Heure actuelle :{' '}
                {new Date(barathon.start_datetime).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              <View style={styles.pickerWrapper}>
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour
                  onChange={handlePickerChange}
                />
              </View>

              <Text style={styles.previewText}>
                Nouvelle heure :{' '}
                {tempDate.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, loading ? styles.disabledButton : null]}
              onPress={handleConfirmPress}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Modification...' : 'Valider'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
