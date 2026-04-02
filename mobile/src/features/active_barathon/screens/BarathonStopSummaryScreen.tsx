import { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { styles } from '../styles/barathonStopSummary.styles';

type Stop = {
  id: number;
  name: string;
  stop_type: 'bar' | 'food';
  latitude: number;
  longitude: number;
  stop_order: number;
};

export default function BarathonStopSummaryScreen() {
  const params = useLocalSearchParams<{
    barathonId?: string;
    barathonName?: string;
    totalStops?: string;
    completedStops?: string;
    startDateTimeIso?: string;
    endDateTimeIso?: string;
    stopsJson?: string;
      source?: string;
  }>();

  const totalStops = Number(params.totalStops ?? 0);
  const completedStops = Number(params.completedStops ?? 0);

  const stops: Stop[] = useMemo(() => {
    if (!params.stopsJson || typeof params.stopsJson !== 'string') {
      return [];
    }

    try {
      const parsed = JSON.parse(params.stopsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.stopsJson]);

  const completedPercentage = totalStops > 0
    ? Math.round((completedStops / totalStops) * 100)
    : 0;

  const percentageStyle =
    completedPercentage > 85
      ? styles.greenText
      : completedPercentage >= 50
      ? styles.orangeText
      : styles.redText;

  const durationText = useMemo(() => {
    if (!params.startDateTimeIso || !params.endDateTimeIso) {
      return '--';
    }

    const start = new Date(params.startDateTimeIso);
    const end = new Date(params.endDateTimeIso);

    const diffMs = end.getTime() - start.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}min`;
  }, [params.startDateTimeIso, params.endDateTimeIso]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Barathon arrêté</Text>
          <Text style={styles.subtitle}>{params.barathonName ?? 'Barathon'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Résumé</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Stops réalisés</Text>
            <Text style={[styles.value, percentageStyle]}>
              {completedStops} / {totalStops} ({completedPercentage}%)
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Temps passé</Text>
            <Text style={styles.value}>{durationText}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Étapes</Text>

          {stops.map((stop, index) => {
              const isDone = stop.is_completed;

            return (
              <View key={stop.id} style={styles.stopRow}>
                <Text
                  style={[
                    styles.stopStatus,
                    isDone ? styles.greenText : styles.redText,
                  ]}
                >
                  {isDone ? 'Fait' : 'Non fait'}
                </Text>

                <View style={styles.stopTextBlock}>
                  <Text style={styles.stopName}>
                    Étape {index + 1} — {stop.name}
                  </Text>
                  <Text style={styles.stopType}>
                    {stop.stop_type === 'bar' ? 'Bar' : 'Restaurant'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (params.source === 'past') {
              router.replace('/past');
              return;
            }

            if (params.source === 'active') {
              router.replace('/planned');
              return;
            }

            // cas par défaut (ex: active)
            router.replace('/home');
          }}
        >
          <Text style={styles.primaryButtonText}>Retour à mes barathons</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
