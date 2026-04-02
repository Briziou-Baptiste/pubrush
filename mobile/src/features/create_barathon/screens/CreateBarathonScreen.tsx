import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BarathonField from '../components/BarathonField';
import DateTimeModalField from '../components/DateTimeModalField';
import { styles } from '../styles/createBarathon.styles';
import { mergeDateAndTime } from '../utils/createBarathon.validators';

export default function CreateBarathonScreen() {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [travelTime, setTravelTime] = useState('');
  const [maxTimeInBar, setMaxTimeInBar] = useState('');

  function validateBeforeContinue() {
    if (!name.trim()) {
      Alert.alert('Formulaire invalide', 'Le nom du barathon est requis.');
      return false;
    }

    if (!startDate) {
      Alert.alert('Formulaire invalide', 'La date de début est requise.');
      return false;
    }

    if (!startTime) {
      Alert.alert('Formulaire invalide', "L'heure de début est requise.");
      return false;
    }

    if (!travelTime.trim() || Number.isNaN(Number(travelTime)) || Number(travelTime) <= 0) {
      Alert.alert(
        'Formulaire invalide',
        'Le temps de trajet doit être un nombre supérieur à 0.'
      );
      return false;
    }

    if (
      !maxTimeInBar.trim() ||
      Number.isNaN(Number(maxTimeInBar)) ||
      Number(maxTimeInBar) <= 0
    ) {
      Alert.alert(
        'Formulaire invalide',
        'Le temps maximum dans un bar doit être un nombre supérieur à 0.'
      );
      return false;
    }

    return true;
  }

  function handleContinue() {
    if (!validateBeforeContinue() || !startDate || !startTime) {
      return;
    }

    const computedStart = mergeDateAndTime(startDate, startTime);

    router.push({
      pathname: '/create-barathon-map',
      params: {
        name: name.trim(),
        startDateIso: startDate.toISOString(),
        startTimeIso: startTime.toISOString(),
        startDateTimeIso: computedStart.toISOString(),
        travelTime: travelTime.trim(),
        maxTimeInBar: maxTimeInBar.trim(),
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Créer un barathon</Text>
            <Text style={styles.subtitle}>
              Configure les informations générales puis choisis les lieux sur la carte.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Informations générales</Text>

            <BarathonField
              label="Nom"
              value={name}
              onChangeText={setName}
              placeholder="Ex: Barathon centre-ville"
            />

            <DateTimeModalField
              label="Date de début"
              value={startDate}
              onConfirm={setStartDate}
              mode="date"
              placeholder="Choisir une date"
            />

            <DateTimeModalField
              label="Heure de début"
              value={startTime}
              onConfirm={setStartTime}
              mode="time"
              placeholder="Choisir une heure"
            />

            <BarathonField
              label="Temps de trajet entre les bars (minutes)"
              value={travelTime}
              onChangeText={setTravelTime}
              placeholder="Ex: 12"
              keyboardType="numeric"
            />

            <BarathonField
              label="Temps maximum dans un bar (minutes)"
              value={maxTimeInBar}
              onChangeText={setMaxTimeInBar}
              placeholder="Ex: 45"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity onPress={handleContinue} style={styles.submitButton}>
            <Text style={styles.submitButtonText}>Choisir les lieux sur la carte</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
