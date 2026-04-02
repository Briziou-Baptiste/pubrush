//
//  StopCard.tsx
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import { Text, TouchableOpacity, View } from 'react-native';

import BarathonField from './BarathonField';
import { styles } from '../styles/createBarathon.styles';
import { BarathonStopForm, StopType } from '../types/createBarathon.types';

type StopCardProps = {
  index: number;
  stop: BarathonStopForm;
  onChange: (localId: string, patch: Partial<BarathonStopForm>) => void;
  onRemove: (localId: string) => void;
};

const STOP_TYPES: StopType[] = ['bar', 'food', 'meeting_point', 'other'];

export default function StopCard({
  index,
  stop,
  onChange,
  onRemove,
}: StopCardProps) {
  return (
    <View style={styles.stopCard}>
      <View style={styles.stopHeader}>
        <Text style={styles.stopTitle}>Étape {index + 1}</Text>

        <TouchableOpacity onPress={() => onRemove(stop.localId)} style={styles.removeStopButton}>
          <Text style={styles.removeStopButtonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      <BarathonField
        label="Nom du lieu"
        value={stop.name}
        onChangeText={(value) => onChange(stop.localId, { name: value })}
        placeholder="Ex: Le Central"
      />

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Type d’étape</Text>
        <View style={styles.typeRow}>
          {STOP_TYPES.map((type) => {
            const active = stop.stopType === type;

            return (
              <TouchableOpacity
                key={type}
                onPress={() => onChange(stop.localId, { stopType: type })}
                style={[styles.typeChip, active ? styles.typeChipActive : null]}
              >
                <Text style={[styles.typeChipText, active ? styles.typeChipTextActive : null]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BarathonField
        label="Latitude"
        value={stop.latitude}
        onChangeText={(value) => onChange(stop.localId, { latitude: value })}
        placeholder="Ex: 43.604700"
        keyboardType="numeric"
      />

      <BarathonField
        label="Longitude"
        value={stop.longitude}
        onChangeText={(value) => onChange(stop.localId, { longitude: value })}
        placeholder="Ex: 1.444200"
        keyboardType="numeric"
      />
    </View>
  );
}
