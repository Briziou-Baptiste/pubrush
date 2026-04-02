import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Text,
  TouchableOpacity,
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

  useEffect(() => {
    loadCurrentUserId();
    loadData();
  }, []);

  async function loadCurrentUserId() {
    try {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    } catch (error) {
      console.log('Impossible de charger currentUserId', error);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const data = await getMyPastBarathons();
      setBarathons(data);
    } catch (error) {
      Alert.alert(
        'Chargement impossible',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    } finally {
      setLoading(false);
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
        },
      });
    }
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

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
