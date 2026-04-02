import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View, TouchableOpacity, Text, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Region } from 'react-native-maps';

import { getBarathonById, getMyActiveBarathon, stopBarathon } from '../services/activeBarathon.service';
import { ActiveBarathonData } from '../types/activeBarathon.types';
import { useActiveBarathonTracking } from '../hooks/useActiveBarathonTracking';
import { styles } from '../styles/activeBarathon.styles';
import ActiveBarathonHeader from '../components/ActiveBarathonHeader';
import ActiveBarathonMap from '../components/ActiveBarathonMap';
import ActiveBarathonBottomPanel from '../components/ActiveBarathonBottomPanel';
import ActiveBarathonTimerCard from '../components/ActiveBarathonTimerCard';

export default function ActiveBarathonScreen() {
  const params = useLocalSearchParams<{ barathonId?: string }>();
  const [barathon, setBarathon] = useState<ActiveBarathonData | null>(null);
  const [loading, setLoading] = useState(true);
    const [stopModalVisible, setStopModalVisible] = useState(false);
    const [stopping, setStopping] = useState(false);
    
  useEffect(() => {
    void loadBarathon();
  }, [params.barathonId]);

  async function loadBarathon() {
    try {
      setLoading(true);

      const data =
        typeof params.barathonId === 'string' && params.barathonId
          ? await getBarathonById(Number(params.barathonId))
          : await getMyActiveBarathon();

      if (!data) {
        Alert.alert('Information', 'Aucun barathon actif trouvé.');
        return;
      }

      setBarathon(data);
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de charger le barathon actif.'
      );
    } finally {
      setLoading(false);
    }
  }

  const tracking = useActiveBarathonTracking({
    barathon: barathon ?? {
      id: 0,
      name: '',
      status: 'started',
      start_datetime: '',
      end_datetime: null,
      max_time_in_bar_minutes: 0,
      travel_time_between_bars_minutes: 0,
      stops: [],
    },
  });

  const initialRegion: Region = useMemo(() => {
    if (!barathon || barathon.stops.length === 0) {
      return {
        latitude: 43.6047,
        longitude: 1.4442,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return {
      latitude: barathon.stops[0].latitude,
      longitude: barathon.stops[0].longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }, [barathon]);

  const phaseLabel = useMemo(() => {
    switch (tracking.state.phase) {
      case 'in_stop':
        return 'Dans le bar';
      case 'overtime':
        return 'Temps dépassé';
      case 'finished':
        return 'Barathon terminé';
      default:
        return 'En route';
    }
  }, [tracking.state.phase]);
    
    const visibleStops = useMemo(() => {
      if (!barathon) {
        return [];
      }

      return barathon.stops.slice(
        tracking.state.activeStopIndex,
        tracking.state.activeStopIndex + 2
      );
    }, [barathon, tracking.state.activeStopIndex]);
    
  if (loading || !barathon) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }
    async function handleConfirmStopBarathon() {
      if (!barathon) {
        return;
      }

      try {
        setStopping(true);

        await stopBarathon(barathon.id);

        const totalStops = barathon.stops.length;
        const completedStops = tracking.state.activeStopIndex;

        router.replace({
          pathname: '/barathon-stop-summary',
          params: {
            barathonId: String(barathon.id),
            barathonName: barathon.name,
            totalStops: String(totalStops),
            completedStops: String(completedStops),
            startDateTimeIso: barathon.start_datetime,
            endDateTimeIso: new Date().toISOString(),
            stopsJson: JSON.stringify(barathon.stops),
              source: 'active',
          },
        });
      } catch (error) {
        Alert.alert(
          'Erreur',
          error instanceof Error ? error.message : "Impossible d'arrêter le barathon."
        );
      } finally {
        setStopping(false);
        setStopModalVisible(false);
      }
    }
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
          <ActiveBarathonMap
            initialRegion={initialRegion}
            currentLocation={tracking.state.currentLocation}
            activeStop={tracking.activeStop}
            visibleStops={visibleStops}
            routeCoordinates={visibleStops.map((stop) => ({
              latitude: stop.latitude,
              longitude: stop.longitude,
            }))}
            visitedPath={tracking.state.visitedPath}
          />

        <View style={styles.topOverlay}>
          <ActiveBarathonHeader
            title={barathon.name}
            stepLabel={`Étape ${tracking.state.activeStopIndex + 1} / ${barathon.stops.length}`}
            phaseLabel={phaseLabel}
            remainingSeconds={tracking.state.remainingSeconds}
            onStopPress={() => setStopModalVisible(true)}
          />
        </View>

        <View style={styles.bottomOverlay}>
          <ActiveBarathonBottomPanel
            stopName={tracking.activeStop?.name ?? 'Aucun stop'}
            distanceLabel={
              tracking.distanceToActiveStopMeters !== null
                ? `${tracking.distanceToActiveStopMeters} m`
                : '--'
            }
            onOpenGoogleMaps={tracking.openInGoogleMaps}
          />
        </View>
      </View>
          <Modal
            visible={stopModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setStopModalVisible(false)}
          >
            <View style={styles.stopModalOverlay}>
              <View style={styles.stopModalCard}>
                <Text style={styles.stopModalTitle}>Arrêter le barathon ?</Text>
                <Text style={styles.stopModalText}>
                  Veux-tu vraiment arrêter ce barathon ?
                </Text>

                <View style={styles.stopModalButtonsRow}>
                  <TouchableOpacity
                    style={styles.stopModalCancelButton}
                    onPress={() => setStopModalVisible(false)}
                    disabled={stopping}
                  >
                    <Text style={styles.stopModalCancelButtonText}>Non</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.stopModalConfirmButton}
                    onPress={handleConfirmStopBarathon}
                    disabled={stopping}
                  >
                    <Text style={styles.stopModalConfirmButtonText}>
                      {stopping ? 'Arrêt...' : 'Oui'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
    </SafeAreaView>
  );
}
