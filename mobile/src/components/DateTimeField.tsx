//
//  DateTimeField.tsx
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { styles } from '../features/create_barathon/styles/createBarathon.styles';

type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  mode: 'date' | 'time';
  placeholder?: string;
};

export default function DateTimeField({
  label,
  value,
  onChange,
  mode,
  placeholder = 'Sélectionner',
}: DateTimeFieldProps) {
  const [show, setShow] = useState(false);

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') {
      setShow(false);
    }

    if (event.type === 'dismissed') {
      setShow(false);
      return;
    }

    if (selectedDate) {
      onChange(selectedDate);
    }
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

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.dateInputButton}
        onPress={() => setShow(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.dateInputButtonText}>{formatDisplay(value)}</Text>
      </TouchableOpacity>

      {show ? (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
