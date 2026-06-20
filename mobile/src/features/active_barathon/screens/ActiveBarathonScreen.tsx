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
import { fetchMyRoleInBarathon, fetchBarathon } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ActiveBarathonScreen() {
  const params = useLocalSearchParams<{ barathonId?: string }>();
  const [barathon, setBarathon] = useState<ActiveBarathonData | null>(null);
  const [loading, setLoading] = useState(true);
    const [stopModalVisible, setStopModalVisible] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    
  useEffect(() => {
    void loadBarathon();
  }, [params.barathonId]);

  // Loads the active barathon details and the user's role from the backend
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

      if (data?.id) {
        const token = await getAccessToken();
        if (token) {
          // Fetch the user's specific role to enable/disable certain features like expenses
          const roleRes = await fetchMyRoleInBarathon(data.id, token);
          setUserRole(roleRes.role);
        }
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de charger le barathon actif.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Custom hook that handles GPS tracking, geofencing, and timers for the active barathon
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

  useEffect(() => {
    if (!barathon?.id) {
      return;
    }

    console.log('[POLLING] Setting up status polling interval for barathon ID:', barathon.id);

    const interval = setInterval(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        console.log('[POLLING] Querying status for barathon ID:', barathon.id);
        const data = await fetchBarathon(barathon.id, token);
        console.log('[POLLING] Status returned:', data?.status);

        if (data && (data.status === 'stopped' || data.status === 'completed')) {
          console.log('[POLLING] Redirecting to summary...');
          
          // Stop GPS tracking
          await tracking.stopTracking();

          // Redirect to summary
          router.replace({
            pathname: '/barathon-stop-summary',
            params: {
              barathonId: String(barathon.id),
              barathonName: barathon.name,
              totalStops: String(barathon.stops.length),
              completedStops: String(tracking.state.activeStopIndex),
              startDateTimeIso: barathon.start_datetime,
              endDateTimeIso: data.ended_at || data.end_datetime || new Date().toISOString(),
              stopsJson: JSON.stringify(barathon.stops),
              source: 'active',
            },
          });
        }
      } catch (error) {
        console.error('[POLLING] Failed to poll barathon status:', error);
      }
    }, 6000); // Poll every 6 seconds

    return () => {
      console.log('[POLLING] Cleaning up status polling interval for barathon ID:', barathon.id);
      clearInterval(interval);
    };
  }, [barathon?.id, barathon?.name, tracking.state.activeStopIndex]);

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
    


  // Determines if the user is currently at the final stop of the barathon
  const isLastStop = useMemo(() => {
    if (!barathon) return false;
    return tracking.state.activeStopIndex === barathon.stops.length - 1;
  }, [barathon, tracking.state.activeStopIndex]);

  // Checks if the user has the "Maître des comptes" role to access the expenses feature
  const isMaitreDesComptes = useMemo(() => {
    const roleLower = userRole?.toLowerCase() ?? '';
    return roleLower === 'maître des comptes' || roleLower === 'maitre des comptes';
  }, [userRole]);

  // Handles the "Next Step" button press. Either completes the barathon or advances to the next stop
  function handleNextStep() {
    if (isLastStop) {
      setStopModalVisible(true);
    } else {
      tracking.goToNextStop();
    }
  }
    
  if (loading || !barathon) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }
    // Completes the barathon, stops GPS tracking, and navigates to the summary screen
    async function handleConfirmStopBarathon() {
      if (!barathon) {
        return;
      }

      try {
        setStopping(true);

        await stopBarathon(barathon.id);
          await tracking.stopTracking();
          
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
    <View style={styles.safeArea}>
      <View style={styles.container}>
          <ActiveBarathonMap
            initialRegion={initialRegion}
            currentLocation={tracking.state.currentLocation}
            visitedPath={tracking.state.visitedPath}
            allStops={barathon.stops}
            activeStopIndex={tracking.state.activeStopIndex}
          />

        <View style={styles.topOverlay}>
          <ActiveBarathonHeader
            title={barathon.name}
            stepLabel={`Étape ${tracking.state.activeStopIndex + 1} / ${barathon.stops.length}`}
            phaseLabel={phaseLabel}
            remainingSeconds={tracking.state.remainingSeconds}
            onStopPress={() => setStopModalVisible(true)}
            onExpensesPress={
              isMaitreDesComptes
                ? () =>
                    router.push({
                      pathname: '/barathon-expenses',
                      params: {
                        barathonId: String(barathon.id),
                        currentStopName: tracking.activeStop?.name ?? '',
                      },
                    })
                : undefined
            }
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
            onNextStep={handleNextStep}
            isLastStop={isLastStop}
            isInsideStop={tracking.state.phase !== 'en_route'}
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
    </View>
  );
}
