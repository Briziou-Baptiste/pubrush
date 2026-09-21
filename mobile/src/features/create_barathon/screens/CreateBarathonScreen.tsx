import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import BarathonField from '../components/BarathonField';
import DateTimeModalField from '../components/DateTimeModalField';
import { styles } from '../styles/createBarathon.styles';
import { mergeDateAndTime } from '../utils/createBarathon.validators';
import { getAccessToken } from '../../../lib/authStorage';

const TIME_IN_BAR_PRESETS = [
  { label: '30 min', value: '30' },
  { label: '45 min (recommandé)', value: '45' },
  { label: '1h (60 min)', value: '60' },
  { label: '1h30 (90 min)', value: '90' },
];

const TRAVEL_TIME_PRESETS = [
  { label: '8 min', value: '8' },
  { label: '12 min (standard)', value: '12' },
  { label: '15 min', value: '15' },
  { label: '20 min', value: '20' },
];

export default function CreateBarathonScreen() {
  const params = useLocalSearchParams<{
    initialName?: string;
    initialTravelTime?: string;
    initialMaxTimeInBar?: string;
    initialStopsJson?: string;
  }>();

  const [name, setName] = useState(params.initialName ?? '');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [travelTime, setTravelTime] = useState(params.initialTravelTime ?? '12');
  const [maxTimeInBar, setMaxTimeInBar] = useState(params.initialMaxTimeInBar ?? '45');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (params.initialName) setName(params.initialName);
    if (params.initialTravelTime) setTravelTime(params.initialTravelTime);
    if (params.initialMaxTimeInBar) setMaxTimeInBar(params.initialMaxTimeInBar);
  }, [params.initialName, params.initialTravelTime, params.initialMaxTimeInBar]);

  // Quick DateTime shortcuts
  function handleQuickTime(type: 'tonight' | 'tomorrow' | 'saturday') {
    const now = new Date();
    let target = new Date();

    if (type === 'tonight') {
      target.setHours(20, 0, 0, 0);
      if (now.getHours() >= 20) {
        target.setDate(target.getDate() + 1);
      }
    } else if (type === 'tomorrow') {
      target.setDate(now.getDate() + 1);
      target.setHours(19, 30, 0, 0);
    } else if (type === 'saturday') {
      const day = now.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7 || 7;
      target.setDate(now.getDate() + daysUntilSaturday);
      target.setHours(20, 0, 0, 0);
    }

    setStartDate(new Date(target));
    setStartTime(new Date(target));
  }

  const nameError = submitted && !name.trim() ? 'Le nom du barathon est requis' : null;
  const dateError = submitted && !startDate ? 'La date de début est requise' : null;
  const timeError = submitted && !startTime ? "L'heure de début est requise" : null;
  const travelError =
    submitted && (!travelTime.trim() || Number.isNaN(Number(travelTime)) || Number(travelTime) <= 0)
      ? 'Indiquez un temps de marche valide (ex: 12)'
      : null;
  const barTimeError =
    submitted && (!maxTimeInBar.trim() || Number.isNaN(Number(maxTimeInBar)) || Number(maxTimeInBar) <= 0)
      ? 'Indiquez un temps au bar valide (ex: 45)'
      : null;

  const isFormValid =
    name.trim().length > 0 &&
    startDate !== null &&
    startTime !== null &&
    Number(travelTime) > 0 &&
    Number(maxTimeInBar) > 0;

  async function handleContinue() {
    setSubmitted(true);

    if (!isFormValid || !startDate || !startTime) {
      Alert.alert(
        'Informations manquantes',
        'Veuillez renseigner le nom, la date, l’heure et les durées pour continuer.'
      );
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
        initialStopsJson: params.initialStopsJson || '',
        partnerEventId: '',
        partnerEventName: '',
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Row / Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>

          {/* Visual Stepper */}
          <View style={styles.stepperWrapper}>
            <View style={styles.stepperBar}>
              <View style={[styles.stepperSegment, styles.stepperSegmentActive]} />
              <View style={styles.stepperSegment} />
              <View style={styles.stepperSegment} />
            </View>
            <Text style={styles.stepperText}>Étape 1 sur 3 • Configuration générale</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Créer un barathon</Text>
            <Text style={styles.subtitle}>
              Configure les informations de base de ta soirée, puis choisis les lieux sur la carte.
            </Text>
          </View>

          {/* Section: Nom */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Nom du barathon</Text>
            <BarathonField
              label="Nom de l'événement"
              value={name}
              onChangeText={setName}
              placeholder="Ex: Barathon des copains, Rue de la Soif..."
            />
            {nameError && <Text style={styles.inlineError}>{nameError}</Text>}
          </View>

          {/* Section: Date & Heure */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Date & Heure de début</Text>

            {/* Quick DateTime chips */}
            <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Raccourcis rapides :</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickTime('tonight')}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>Ce soir 20h00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickTime('tomorrow')}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>Demain 19h30</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickTime('saturday')}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>Samedi 20h00</Text>
              </TouchableOpacity>
            </View>

            <DateTimeModalField
              label="Date de début"
              value={startDate}
              onConfirm={setStartDate}
              mode="date"
              placeholder="Choisir une date personnalisée"
            />
            {dateError && <Text style={styles.inlineError}>{dateError}</Text>}

            <DateTimeModalField
              label="Heure de début"
              value={startTime}
              onConfirm={setStartTime}
              mode="time"
              placeholder="Choisir une heure personnalisée"
            />
            {timeError && <Text style={styles.inlineError}>{timeError}</Text>}
          </View>

          {/* Section: Rythme & Temps */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Rythme du barathon</Text>

            {/* Temps par bar */}
            <Text style={styles.fieldLabel}>Temps maximum dans chaque bar</Text>
            <View style={styles.chipsContainer}>
              {TIME_IN_BAR_PRESETS.map((p) => {
                const isActive = maxTimeInBar === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setMaxTimeInBar(p.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <BarathonField
              label="Ou durée personnalisée (en minutes)"
              value={maxTimeInBar}
              onChangeText={setMaxTimeInBar}
              placeholder="Ex: 45"
              keyboardType="numeric"
            />
            {barTimeError && <Text style={styles.inlineError}>{barTimeError}</Text>}

            <View style={{ height: 16 }} />

            {/* Temps de marche */}
            <Text style={styles.fieldLabel}>Temps de marche max entre les bars</Text>
            <View style={styles.chipsContainer}>
              {TRAVEL_TIME_PRESETS.map((p) => {
                const isActive = travelTime === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setTravelTime(p.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <BarathonField
              label="Ou temps de trajet max personnalisé (en minutes)"
              value={travelTime}
              onChangeText={setTravelTime}
              placeholder="Ex: 12"
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              Ce temps définit le périmètre de recherche des bars accessibles à pied sur la carte.
            </Text>
            {travelError && <Text style={styles.inlineError}>{travelError}</Text>}
          </View>

          {/* Continue button */}
          <TouchableOpacity
            onPress={handleContinue}
            style={[
              styles.submitButton,
              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
            ]}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Choisir les lieux sur la carte</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
