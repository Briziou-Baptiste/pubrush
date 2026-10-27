import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,

  View,
} from 'react-native';

import { getCurrentUserId } from '../../../lib/authStorage';
import BarathonCard from '../../barathon_past_planned/components/BarathonCard';
import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';
import { getMyPastBarathons } from '../services/past.service';
import { styles } from '../styles/past.styles';

export default function PastScreen() {
  const [barathons, setBarathons] = useState<BarathonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadSequence = useRef(0);
  useEffect(() => { void loadCurrentUserId(); }, []);
  useFocusEffect(useCallback(() => {
    void loadData();
    return () => { loadSequence.current++; };
  }, []));

  async function loadCurrentUserId() {
    try {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    } catch (error) {
      console.log('Impossible de charger currentUserId', error);
    }
  }

  async function loadData() {
    const sequence = ++loadSequence.current;
    try {
      setLoading(true);
      const data = await getMyPastBarathons();
      if (sequence === loadSequence.current) setBarathons(data);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      Alert.alert(
        'Chargement impossible',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
    function handleOpenPastSummary(barathon: BarathonListItem) {
      const completedStopSize = barathon.stops.filter((stop) => stop.is_completed).length;
        const totalStops =barathon.stops.length;
      router.push({
        pathname: '/barathon-stop-summary',
        params: {
          barathonId: String(barathon.id),
          barathonName: barathon.name,
          totalStops: String(totalStops),
          completedStops: String(completedStopSize),
          startDateTimeIso: barathon.start_datetime,
          endDateTimeIso:
            barathon.ended_at ?? barathon.end_datetime ?? new Date().toISOString(),
          stopsJson: JSON.stringify(barathon.stops),
            source: 'past',
            status: barathon.status,
        },
      });
    }
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.container}>

        <Text style={styles.title}>Barathons passés</Text>
        <Text style={styles.subtitle}>
          Retrouve ici l’historique de tes tournées.
        </Text>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            data={barathons}
            refreshing={loading}
            onRefresh={() => void loadData()}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={
              barathons.length === 0 ? styles.emptyListContent : styles.listContent
            }
            renderItem={({ item }) => (
              <BarathonCard
                item={item}
                variant="past"
                currentUserId={currentUserId ?? -1}
               onInfo={handleOpenPastSummary}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>Aucun barathon passé</Text>
                <Text style={styles.emptyStateText}>
                  Les anciens barathons apparaîtront ici.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
