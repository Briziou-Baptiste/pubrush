import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { navigationControlStyles } from '../../../lib/navigation.styles';
import RoutingAttribution from '../../create_barathon/components/RoutingAttribution';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View, TouchableOpacity, Text, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMapControlsLayout } from '../../create_barathon/services/mapLayout.service';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { Region } from 'react-native-maps';

import { getBarathonById, getMyActiveBarathon, stopBarathon, markBarathonFinished, completeBarathonStop, advanceBarathonNextStep } from '../services/activeBarathon.service';
import { ActiveBarathonData } from '../types/activeBarathon.types';
import { ParticipantLocation } from '../types/webSocker.types';
import { useActiveBarathonTracking } from '../hooks/useActiveBarathonTracking';
import { styles } from '../styles/activeBarathon.styles';
import ActiveBarathonHeader from '../components/ActiveBarathonHeader';
import ActiveBarathonMap from '../components/ActiveBarathonMap';
import ActiveBarathonBottomPanel from '../components/ActiveBarathonBottomPanel';
import BarathonRolesModal from '../components/BarathonRolesModal';
import ReplaceOrAddStopModal from '../components/ReplaceOrAddStopModal';
import InviteFriendsModal from '../components/InviteFriendsModal';
import PhotoMysteryModal from '../components/PhotoMysteryModal';
import { PhotoMysterySnapshot } from '../types/photoMystery.types';
import { fetchPhotoMysteryState } from '../services/photoMysteryService';
import { reconcilePhotoMysteryState } from '../utils/photoMysteryState';
import { fetchMyRoleInBarathon, fetchBarathon, fetchBarathonRoles, AssignedBarathonRole, API_BASE_URL } from '../../../lib/api';
import { getAccessToken, getCurrentUserId } from '../../../lib/authStorage';
import { connectBarathonSocket, disconnectBarathonSocket, sendBarathonLocation, WSMessage } from '../services/webSocket.service';
import {
  saveCachedBarathon,
  getCachedBarathon,
  queueOfflineAction,
  flushOfflineActionsQueue,
  getOfflineActionsQueue,
} from '../services/offlineSync.service';

export default function ActiveBarathonScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useEffect(() => {
    const state = navigation.getState();
    if (!state || state.index === 0) return;
    const current = state.routes[state.index];
    if (current.name === 'active-barathon') navigation.reset({ index: 0, routes: [{ key: current.key, name: current.name, params: current.params }] });
  }, [navigation]);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const availableHeight = screenHeight - insets.top - insets.bottom - 24;
  const controlsLayout = getMapControlsLayout(screenHeight - insets.bottom - 12 - bottomHeight,
    insets.top + 12 + headerHeight);
  const params = useLocalSearchParams<{ barathonId?: string }>();
  const [barathon, setBarathon] = useState<ActiveBarathonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [endingMode, setEndingMode] = useState<'stop' | 'finish'>('stop');
  const endingInFlight = useRef(false);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [modifyMode, setModifyMode] = useState<'replace' | 'add'>('replace');
  const [stopping, setStopping] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<AssignedBarathonRole[]>([]);
  const [rolesModalVisible, setRolesModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [photoSnapshot, setPhotoSnapshot] = useState<PhotoMysterySnapshot | null>(null);
  const photoMysteryState = photoSnapshot && photoSnapshot.barathonId === barathon?.id ? photoSnapshot.state : null;
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [friendLocations, setFriendLocations] = useState<Record<number, ParticipantLocation>>({});
  const [isSousSolMode, setIsSousSolMode] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);
  const lastLocationSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  function updatePhotoSnapshot(incoming: PhotoMysterySnapshot) {
    setPhotoSnapshot(current => {
      const previous = current?.barathonId === incoming.barathonId ? current.state : null;
      const result = reconcilePhotoMysteryState(previous, incoming.state, incoming.barathonId, incoming.barathonId);
      return result.shouldUpdate ? { ...incoming, state: result.nextState } : current;
    });
  }

  useEffect(() => {
    getOfflineActionsQueue()
      .then((q) => setPendingOfflineCount(q.length))
      .catch(() => {});
  }, [isSousSolMode]);

  useEffect(() => {
    if (!barathon?.id) return;
    let isMounted = true;
    const loadPhoto = async () => {
      try {
        const s = await fetchPhotoMysteryState(barathon.id);
        if (isMounted) updatePhotoSnapshot({ barathonId: barathon.id, state: s });
      } catch {}
    };
    loadPhoto();
    const timer = setInterval(loadPhoto, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [barathon?.id]);
    
  useEffect(() => {
    void loadBarathon();
  }, [params.barathonId]);

  // Loads the active barathon details, participant roles and the user's role from the backend
  async function loadBarathon() {
    try {
      setLoading(true);

      const data =
        typeof params.barathonId === 'string' && params.barathonId
          ? await getBarathonById(Number(params.barathonId))
          : await getMyActiveBarathon();

      if (!data) {
        const cached = await getCachedBarathon();
        if (cached) {
          setBarathon(cached);
          setIsSousSolMode(true);
          return;
        }
        Alert.alert('Information', 'Aucun barathon actif trouvé.');
        return;
      }

      setBarathon(data);
      void saveCachedBarathon(data);

      if (data?.id) {
        const token = await getAccessToken();
        if (token) {
          // Fetch the user's specific role to enable/disable certain features like expenses
          const [roleRes, rolesRes, uid] = await Promise.all([
            fetchMyRoleInBarathon(data.id, token).catch(() => ({ role: null })),
            fetchBarathonRoles(data.id, token).catch(() => [] as AssignedBarathonRole[]),
            getCurrentUserId(),
          ]);

          setUserRole(roleRes?.role ?? null);
          setRoles(rolesRes);
          if (uid) {
            setCurrentUserId(uid);
          }
        }
      }
    } catch (error) {
      const cached = await getCachedBarathon();
      if (cached) {
        setBarathon(cached);
        setIsSousSolMode(true);
        Alert.alert(
          'Mode Sous-sol',
          'Impossible de joindre le serveur. Ton barathon a été chargé en mode local (sous-sol).'
        );
        return;
      }
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
    onStopCompleted: (stopId) => {
      setBarathon((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stops: prev.stops.map((s) =>
            s.id === stopId ? { ...s, is_completed: true } : s
          ),
        };
      });
    },
  });

  // Connect to Barathon WebSocket room for real-time synchronization across participants
  useEffect(() => {
    if (!barathon) {
      return;
    }

    const currentBarathon = barathon;
    let isMounted = true;

    async function initSocket() {
      const token = await getAccessToken();
      if (!token || !isMounted) return;

      connectBarathonSocket({
        apiBaseUrl: API_BASE_URL,
        token,
        barathonId: currentBarathon.id,
        onOpen: () => {
          console.log('[WS][BARATHON] Connected to barathon room:', currentBarathon.id);
          setIsSousSolMode(false);
          void flushOfflineActionsQueue();

          // Resynchronisation métier complète via REST après connexion ou reconnexion
          if (token && currentBarathon.id) {
            fetchBarathon(currentBarathon.id, token)
              .then((freshData) => {
                if (!isMounted || !freshData) return;

                if (freshData.status === 'stopped' || freshData.status === 'completed') {
                  void tracking.stopTracking();
                  setFriendLocations({});
                  const totalStops = freshData.stops?.length ?? currentBarathon.stops.length;
                  const completedStopsCount = freshData.stops
                    ? freshData.stops.filter((s: any) => s.is_completed).length
                    : currentBarathon.stops.filter((s) => s.is_completed).length;

                  router.replace({
                    pathname: '/barathon-stop-summary',
                    params: {
                      barathonId: String(freshData.id),
                      barathonName: freshData.name,
                      totalStops: String(totalStops),
                      completedStops: String(completedStopsCount),
                      startDateTimeIso: freshData.start_datetime,
                      endDateTimeIso: freshData.ended_at || freshData.end_datetime || new Date().toISOString(),
                      stopsJson: JSON.stringify(freshData.stops || currentBarathon.stops),
                      source: 'active',
                    },
                  });
                  return;
                }

                if (freshData.stops && Array.isArray(freshData.stops)) {
                  setBarathon((prev) => (prev ? { ...prev, ...freshData } : null));
                  const firstIncompleteIdx = freshData.stops.findIndex((s: any) => !s.is_completed);
                  const targetIndex = firstIncompleteIdx === -1 ? 0 : firstIncompleteIdx;
                  if (targetIndex !== tracking.state.activeStopIndex) {
                    void tracking.advanceToStop(targetIndex);
                  }
                }
              })
              .catch((err) => {
                console.warn('[WS][BARATHON] Failed to resync barathon on reconnect:', err);
              });
          }
        },
        onClose: () => {
          console.log('[WS][BARATHON] Closed barathon room:', currentBarathon.id);
          setIsSousSolMode(true);
        },
        onMessage: (message: WSMessage) => {
          console.log('[WS][BARATHON] Event received:', message.type);

          if (message.type === 'BARATHON_NEXT_STEP') {
            const completedStopId = message.payload?.completed_stop_id;
            const nextStopIndex = message.payload?.next_stop_index;

            if (completedStopId) {
              setBarathon((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  stops: prev.stops.map((s) =>
                    s.id === completedStopId ? { ...s, is_completed: true } : s
                  ),
                };
              });
            }

            if (typeof nextStopIndex === 'number') {
              void tracking.advanceToStop(nextStopIndex);
            } else {
              void tracking.goToNextStop();
            }
          } else if (message.type === 'BARATHON_STOP_COMPLETED') {
            const completedStopId = message.payload?.stop_id;
            const nextStopIndex = message.payload?.next_stop_index;

            if (completedStopId) {
              setBarathon((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  stops: prev.stops.map((s) =>
                    s.id === completedStopId ? { ...s, is_completed: true } : s
                  ),
                };
              });
            }

            if (typeof nextStopIndex === 'number') {
              void tracking.advanceToStop(nextStopIndex);
            } else {
              void tracking.goToNextStop();
            }
          } else if (message.type === 'BARATHON_STOP_REPLACED') {
            const { stops, old_name, new_name, reason, user_id, username } = message.payload || {};
            if (stops && Array.isArray(stops)) {
              setBarathon((prev) => (prev ? { ...prev, stops } : null));
            }
            if (user_id !== currentUserId) {
              Alert.alert(
                'Étape modifiée',
                `${username || 'Le maître du trajet'} a remplacé "${old_name}" par "${new_name}" (Raison: ${reason}).`
              );
            }
          } else if (message.type === 'BARATHON_STOP_ADDED') {
            const { stops, added_stop, user_id, username } = message.payload || {};
            if (stops && Array.isArray(stops)) {
              setBarathon((prev) => (prev ? { ...prev, stops } : null));
            }
            if (user_id !== currentUserId) {
              Alert.alert(
                'Nouvelle étape ajoutée',
                `${username || 'Le maître du trajet'} a ajouté "${added_stop?.name ?? 'un nouveau bar'}" au parcours.`
              );
            }
          } else if (message.type === 'BARATHON_PARTICIPANT_JOINED') {
            const newUser = message.payload?.user;
            if (newUser && newUser.id !== currentUserId) {
              Alert.alert(
                'Nouveau participant !',
                `${newUser.username}${newUser.is_guest ? ' (Invité)' : ''} a rejoint le barathon !`
              );
              if (token && currentBarathon.id) {
                fetchBarathonRoles(currentBarathon.id, token)
                  .then((updatedRoles) => setRoles(updatedRoles))
                  .catch(() => {});
              }
            }
          } else if (message.type === 'FRIEND_LOCATION_UPDATE') {
            const loc = message.payload;
            if (loc && loc.user_id !== currentUserId) {
              console.log('[WS][BARATHON] Friend location update received for user:', loc.user_id);
              setFriendLocations((prev) => ({
                ...prev,
                [loc.user_id]: loc,
              }));
            }
          } else if (message.type === 'FRIENDS_LOCATIONS_SNAPSHOT') {
            // Remplacement COMPLET de l'état par le snapshot (élimine tout ami expiré ou déconnecté)
            const list = message.payload?.locations || [];
            const nextLocations: Record<number, ParticipantLocation> = {};
            for (const loc of list) {
              if (loc.user_id !== currentUserId) {
                nextLocations[loc.user_id] = loc;
              }
            }
            console.log('[WS][BARATHON] Friends snapshot applied, count:', Object.keys(nextLocations).length);
            setFriendLocations(nextLocations);
          } else if (message.type === 'FRIEND_LOCATION_EXPIRED') {
            const expiredUserId = message.payload?.user_id;
            if (expiredUserId) {
              console.log('[WS][BARATHON] Friend location expired for user:', expiredUserId);
              setFriendLocations((prev) => {
                if (!prev[expiredUserId]) return prev;
                const updated = { ...prev };
                delete updated[expiredUserId];
                return updated;
              });
            }
          } else if (message.type === 'PHOTO_MYSTERY_UPDATE') {
            if (message.barathon_id === currentBarathon.id) {
              fetchPhotoMysteryState(currentBarathon.id)
                .then((s) => {
                  if (isMounted) updatePhotoSnapshot({ barathonId: currentBarathon.id, state: s });
                })
                .catch(() => {});
            }
          } else if (message.type === 'BARATHON_STOPPED' || message.type === 'BARATHON_FINISHED') {
            void tracking.stopTracking();
            setFriendLocations({});
            const totalStops = currentBarathon.stops.length;
            const completedStopsCount = currentBarathon.stops.filter((s) => s.is_completed).length;

            router.replace({
              pathname: '/barathon-stop-summary',
              params: {
                barathonId: String(currentBarathon.id),
                barathonName: currentBarathon.name,
                totalStops: String(totalStops),
                completedStops: String(completedStopsCount),
                startDateTimeIso: currentBarathon.start_datetime,
                endDateTimeIso: new Date().toISOString(),
                stopsJson: JSON.stringify(currentBarathon.stops),
                source: 'active',
              },
            });
          }
        },
      });
    }

    void initSocket();

    return () => {
      isMounted = false;
      disconnectBarathonSocket();
    };
  }, [barathon?.id, barathon?.name]);

  // Broadcast own GPS location over WebSocket (throttled to preserve battery and bandwidth)
  useEffect(() => {
    const loc = tracking.state.currentLocation;
    if (!loc || !barathon?.id || isSousSolMode) return;

    const now = Date.now();
    const lastSent = lastLocationSentRef.current;
    if (
      !lastSent ||
      now - lastSent.time >= 8000 ||
      Math.abs(loc.latitude - lastSent.lat) > 0.0001 ||
      Math.abs(loc.longitude - lastSent.lng) > 0.0001
    ) {
      sendBarathonLocation(loc.latitude, loc.longitude);
      console.log('[GPS] Location beacon transmitted to barathon room');
      lastLocationSentRef.current = { lat: loc.latitude, lng: loc.longitude, time: now };
    }
  }, [tracking.state.currentLocation, barathon?.id, isSousSolMode]);

  // Quiet fallback check every 30 seconds in case WebSocket dropped
  useEffect(() => {
    if (!barathon?.id) return;

    const interval = setInterval(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const data = await fetchBarathon(barathon.id, token);
        if (data && (data.status === 'stopped' || data.status === 'completed')) {
          await tracking.stopTracking();

          const totalStops = barathon.stops.length;
          const completedStopsCount = data.stops
            ? data.stops.filter((s: any) => s.is_completed).length
            : barathon.stops.filter((s) => s.is_completed).length;

          router.replace({
            pathname: '/barathon-stop-summary',
            params: {
              barathonId: String(barathon.id),
              barathonName: barathon.name,
              totalStops: String(totalStops),
              completedStops: String(completedStopsCount),
              startDateTimeIso: barathon.start_datetime,
              endDateTimeIso: data.ended_at || data.end_datetime || new Date().toISOString(),
              stopsJson: JSON.stringify(data.stops || barathon.stops),
              source: 'active',
            },
          });
        }
      } catch {
        // Silently ignore transient network errors during fallback polling
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [barathon?.id]);

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

  // Checks if the user is the "Maître du trajet" (creator of the barathon, or role containing 'trajet' or 'capitaine')
  const isMaitreDuTrajet = useMemo(() => {
    if (!barathon || !currentUserId) return false;
    if (barathon.created_by_user_id === currentUserId) return true;
    const roleLower = userRole?.toLowerCase() ?? '';
    if (roleLower.includes('trajet') || roleLower.includes('capitaine')) return true;
    const assignedRole = roles.find((r) => r.user_id === currentUserId);
    if (assignedRole) {
      const assignedLower = assignedRole.role_name.toLowerCase();
      if (assignedLower.includes('trajet') || assignedLower.includes('capitaine')) return true;
    }
    return false;
  }, [barathon, currentUserId, userRole, roles]);

  async function handleInvite() {
    if (!barathon) return;
    try {
      // active-view rejects sessions that have ended or have been deleted.
      const fresh = await getBarathonById(barathon.id);
      if (fresh.status !== 'started' || !fresh.join_code?.trim()) {
        throw new Error('Ce barathon ne permet plus les invitations.');
      }
      setBarathon(current => current ? { ...current, join_code: fresh.join_code } : current);
      setInviteModalVisible(true);
    } catch (error) {
      Alert.alert('Invitation indisponible', error instanceof Error ? error.message : 'Réessaie plus tard.');
    }
  }

  // Handles the "Next Step" button press. Either completes the barathon or advances to the next stop
  async function handleNextStep() {
    if (isLastStop) {
      setEndingMode('finish');
      setStopModalVisible(true);
      return;
    }

    if (!barathon) {
      return;
    }

    try {
      // 1. Notify the backend which broadcasts via WebSocket to all other participants
      await advanceBarathonNextStep(barathon.id);
    } catch (error) {
      console.warn('[handleNextStep] Network error, queuing action for offline sync:', error);
      setIsSousSolMode(true);
      void queueOfflineAction({
        type: 'ADVANCE_STEP',
        barathonId: barathon.id,
      });
    }

    // 2. Avancer également immédiatement en local
    await tracking.goToNextStop();
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
      if (!barathon || endingInFlight.current) return;
      endingInFlight.current = true;

      try {
        setStopping(true);

        const currentStop = barathon.stops[tracking.state.activeStopIndex];
        const shouldCompleteCurrent =
          endingMode === 'finish' ||
          tracking.state.phase === 'in_stop' ||
          tracking.state.phase === 'overtime';

        if (currentStop && !currentStop.is_completed && shouldCompleteCurrent) {
          try {
            await completeBarathonStop(barathon.id, currentStop.id);
            currentStop.is_completed = true;
          } catch (err) {
            if (endingMode === 'finish') throw err;
            console.error('Failed to complete current stop before ending:', err);
          }
        }

        const stopResult = endingMode === 'finish'
          ? await markBarathonFinished(barathon.id)
          : await stopBarathon(barathon.id);
        await tracking.stopTracking();
          
        const totalStops = barathon.stops.length;
        const completedStopsCount = barathon.stops.filter((s) => s.is_completed).length;

        router.replace({
          pathname: '/barathon-stop-summary',
          params: {
            barathonId: String(barathon.id),
            barathonName: barathon.name,
            totalStops: String(totalStops),
            completedStops: String(completedStopsCount),
            startDateTimeIso: barathon.start_datetime,
            endDateTimeIso: stopResult?.ended_at || new Date().toISOString(),
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
        endingInFlight.current = false;
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
            friendLocations={Object.values(friendLocations)}
            currentUserId={currentUserId}
            controlsLayout={headerHeight && bottomHeight ? controlsLayout : undefined}
            rightInset={insets.right}
          />

        <View style={[styles.topOverlay, { top: insets.top + 12, left: insets.left + 12, right: insets.right + 12 }]}
          onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
          <ScrollView style={{ maxHeight: availableHeight * 0.30 }} bounces={false}>
          <ActiveBarathonHeader
            title={barathon.name}
            stepLabel={`Étape ${tracking.state.activeStopIndex + 1} / ${barathon.stops.length}`}
            phaseLabel={phaseLabel}
            remainingSeconds={tracking.state.remainingSeconds}
            totalBarSeconds={barathon.max_time_in_bar_minutes * 60}
            onRolesPress={() => setRolesModalVisible(true)}
            onInvitePress={handleInvite}
            onPhotoPress={() => setPhotoModalVisible(true)}
            photoPendingCount={photoMysteryState?.pending_count ?? 0}
            onTimerPress={tracking.state.phase === 'en_route' ? tracking.startStopTimer : undefined}
            onStopPress={() => { setEndingMode('stop'); setStopModalVisible(true); }}
            isSousSolMode={isSousSolMode}
            pendingOfflineActionsCount={pendingOfflineCount}
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
          </ScrollView>
        </View>

        <View style={[styles.bottomOverlay, { bottom: insets.bottom + 12, left: insets.left + 12, right: insets.right + 12 }]}
          onLayout={event => setBottomHeight(event.nativeEvent.layout.height)}>
          <ScrollView style={{ maxHeight: availableHeight * 0.40 }} bounces={false}>
          <ActiveBarathonBottomPanel
            stopName={tracking.activeStop?.name ?? 'Aucun stop'}
            stopType={tracking.activeStop?.stop_type}
            distanceLabel={
              tracking.distanceToActiveStopMeters !== null
                ? `${tracking.distanceToActiveStopMeters} m`
                : '--'
            }
            estimatedMinutes={tracking.estimatedWalkMinutes}
            onOpenGoogleMaps={tracking.openInGoogleMaps}
            onArrivedAtBar={tracking.startStopTimer}
            onNextStep={handleNextStep}
            onReplacePress={() => {
              setModifyMode('replace');
              setModifyModalVisible(true);
            }}
            onAddStopPress={() => {
              setModifyMode('add');
              setModifyModalVisible(true);
            }}
            isMaitreDuTrajet={isMaitreDuTrajet}
            isLastStop={isLastStop}
            isInsideStop={tracking.state.phase !== 'en_route'}
          />
          <RoutingAttribution />
          </ScrollView>
        </View>
      </View>

      <BarathonRolesModal
        visible={rolesModalVisible}
        onClose={() => setRolesModalVisible(false)}
        roles={roles}
        currentUserId={currentUserId}
      />

      <ReplaceOrAddStopModal
        visible={modifyModalVisible}
        mode={modifyMode}
        currentStop={tracking.activeStop ?? null}
        lastStop={barathon.stops[barathon.stops.length - 1] ?? null}
        barathonId={barathon.id}
        userLocation={tracking.state.currentLocation}
        onClose={() => setModifyModalVisible(false)}
        onSuccess={(updated) => {
          setBarathon(updated);
        }}
      />

      <InviteFriendsModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        joinCode={barathon.join_code || ''}
        barathonName={barathon.name}
        participantsCount={roles.length || 1}
      />

      <PhotoMysteryModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        barathonId={barathon.id}
        initialSnapshot={photoSnapshot}
        onStateUpdated={updatePhotoSnapshot}
      />

      <Modal
        visible={stopModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!stopping) setStopModalVisible(false); }}
      >
        <SafeAreaView style={styles.stopModalOverlay}>
          <View style={styles.stopModalCard}>
            <Text style={styles.stopModalTitle}>{endingMode === 'finish' ? 'Terminer le barathon ?' : 'Arrêter le barathon ?'}</Text>
            <Text style={styles.stopModalText}>
              {endingMode === 'finish' ? 'Confirmer la fin de la tournée ?' : 'Veux-tu vraiment interrompre cette tournée ?'}
            </Text>

            <View style={styles.stopModalButtonsRow}>
              <TouchableOpacity
                style={[styles.stopModalCancelButton, navigationControlStyles.action]}
                onPress={() => setStopModalVisible(false)}
                disabled={stopping}
              >
                <Text style={styles.stopModalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stopModalConfirmButton, navigationControlStyles.action]}
                onPress={handleConfirmStopBarathon}
                disabled={stopping}
              >
                <Text style={styles.stopModalConfirmButtonText}>
                  {stopping ? 'En cours...' : endingMode === 'finish' ? 'Terminer' : 'Arrêter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
