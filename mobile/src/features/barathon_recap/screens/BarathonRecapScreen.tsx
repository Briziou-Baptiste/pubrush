import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { createBarathonRecapStyles as styles } from '../../create_barathon/styles/createBarathonRecap.styles';
import { createBarathon } from '../../create_barathon/services/createBarathon.service';
import {
  addParticipantsToBarathon,
  getBarathonDetails,
  searchUsers,
  removeParticipantFromBarathon,
} from '../services/barathonRecap.service';
import {
  CreateBarathonPayload,
  CreateBarathonRecapStop,
  SearchUserResult,
  StopType,
} from '../../create_barathon/types/createBarathon.types';
import { getCurrentUser, getAccessToken } from '../../../lib/authStorage';
import { fetchBarathonExpenses } from '../../../lib/api';
import { fetchWalkingRoute, RouteSegment } from '../../create_barathon/services/routing.service';

type ExistingParticipant = {
  id: number;
  role: string;
  user: SearchUserResult;
};

type ExistingStop = {
  id: number;
  name: string;
  stop_type: StopType;
  latitude: number;
  longitude: number;
  stop_order: number;
};

type ExistingBarathonDetails = {
  id: number;
  name: string;
  start_datetime: string;
  end_datetime: string | null;
  has_started: boolean;
  status: string;
  travel_time_between_bars_minutes: number;
  max_time_in_bar_minutes: number;
  created_by_user_id: number;
  started_at: string | null;
  ended_at: string | null;
  participants: ExistingParticipant[];
  stops: ExistingStop[];
};

type UnifiedStop = {
  id: string;
  name: string;
  stopType: StopType;
  latitude: number;
  longitude: number;
  stopOrder: number;
};

type DebtSettlement = {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
};

function calculateSimplifiedDebts(balances: any[]): DebtSettlement[] {
  const participants = balances.map(b => ({
    user_id: b.user_id,
    username: b.username,
    balance: b.balance,
  }));

  const debtors = participants.filter(p => p.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const creditors = participants.filter(p => p.balance > 0.01).sort((a, b) => b.balance - a.balance);

  const settlements: DebtSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtAmount = -debtor.balance;
    const creditAmount = creditor.balance;

    const amountToSettle = Math.min(debtAmount, creditAmount);

    settlements.push({
      debtorId: debtor.user_id,
      debtorName: debtor.username,
      creditorId: creditor.user_id,
      creditorName: creditor.username,
      amount: amountToSettle,
    });

    debtor.balance += amountToSettle;
    creditor.balance -= amountToSettle;

    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  return settlements;
}

export default function BarathonRecapScreen() {
  const params = useLocalSearchParams<{
    barathonId?: string;
    name?: string;
    startDateTimeIso?: string;
    maxTimeInBar?: string;
    travelTime?: string;
    stopsJson?: string;
    partnerEventId?: string;
  }>();

  const mapRef = useRef<MapView | null>(null);

  const isDetailsMode = typeof params.barathonId === 'string' && !!params.barathonId;

  const [currentUser, setCurrentUser] = useState<SearchUserResult | null>(null);
  const [creatorUserId, setCreatorUserId] = useState<number | null>(null);

  const [participants, setParticipants] = useState<SearchUserResult[]>([]);
  const [initialParticipantIds, setInitialParticipantIds] = useState<number[]>([]);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBarathon, setLoadingBarathon] = useState(isDetailsMode);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [startDateTimeIso, setStartDateTimeIso] = useState<string | null>(null);
  const [maxTimeInBarMinutes, setMaxTimeInBarMinutes] = useState(0);
  const [travelTimeBetweenBarsMinutes, setTravelTimeBetweenBarsMinutes] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [stops, setStops] = useState<UnifiedStop[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [debts, setDebts] = useState<DebtSettlement[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    void initScreen();
  }, [params.barathonId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const cleanValue = search.trim();

      if (cleanValue.length === 0) {
        setResults([]);
        return;
      }

      void handleSearchUsers(cleanValue);
    }, 250);

    return () => clearTimeout(timeout);
  }, [search, participants]);

  async function initScreen() {
    try {
      const user = await getCurrentUser();

      if (!user || !user.id) {
        Alert.alert('Erreur', 'Utilisateur non connecté.');
        return;
      }

      const cleanUser = user as SearchUserResult;
      setCurrentUser(cleanUser);

      if (isDetailsMode && params.barathonId) {
        await loadExistingBarathon(Number(params.barathonId), cleanUser);
      } else {
        loadDraftFromParams(cleanUser);
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d’initialiser la page.'
      );
    } finally {
      setLoadingBarathon(false);
    }
  }

  function loadDraftFromParams(user: SearchUserResult) {
    const draftName =
      typeof params.name === 'string' && params.name.trim()
        ? params.name
        : 'Nouveau barathon';

    const draftStart =
      typeof params.startDateTimeIso === 'string' && params.startDateTimeIso
        ? params.startDateTimeIso
        : null;

    const draftMaxTime = Number(params.maxTimeInBar ?? 0);
    const draftTravelTime = Number(params.travelTime ?? 0);

    let parsedStops: CreateBarathonRecapStop[] = [];
    if (typeof params.stopsJson === 'string' && params.stopsJson) {
      try {
        const raw = JSON.parse(params.stopsJson);
        parsedStops = Array.isArray(raw) ? raw : [];
      } catch {
        parsedStops = [];
      }
    }

    const normalizedStops: UnifiedStop[] = parsedStops.map((stop, index) => ({
      id: stop.id,
      name: stop.name,
      stopType: stop.stopType,
      latitude: stop.latitude,
      longitude: stop.longitude,
      stopOrder: index + 1,
    }));

    setName(draftName);
    setStartDateTimeIso(draftStart);
    setMaxTimeInBarMinutes(Number.isFinite(draftMaxTime) ? draftMaxTime : 0);
    setTravelTimeBetweenBarsMinutes(Number.isFinite(draftTravelTime) ? draftTravelTime : 0);
    setStops(normalizedStops);
    setParticipants([user]);
    setInitialParticipantIds([user.id]);
    setCreatorUserId(user.id);
    setStatus('planned');
  }

  async function loadExistingBarathon(barathonId: number, user: SearchUserResult) {
    const data = (await getBarathonDetails(barathonId)) as ExistingBarathonDetails;

    setName(data.name);
    setStartDateTimeIso(data.start_datetime);
    setMaxTimeInBarMinutes(data.max_time_in_bar_minutes);
    setTravelTimeBetweenBarsMinutes(data.travel_time_between_bars_minutes);
    setCreatorUserId(data.created_by_user_id);
    setStatus(data.status);

    const normalizedStops: UnifiedStop[] = [...data.stops]
      .sort((a, b) => a.stop_order - b.stop_order)
      .map((stop) => ({
        id: String(stop.id),
        name: stop.name,
        stopType: stop.stop_type,
        latitude: stop.latitude,
        longitude: stop.longitude,
        stopOrder: stop.stop_order,
      }));

    const normalizedParticipants = data.participants.map((participant) => participant.user);

    setStops(normalizedStops);
    setParticipants(normalizedParticipants);
    setInitialParticipantIds(normalizedParticipants.map((participant) => participant.id));

    if (!normalizedParticipants.some((participant) => participant.id === user.id)) {
      setCurrentUser(user);
    }

    // Charger les dépenses et les compensations
    if (data.status === 'started' || data.status === 'completed') {
      try {
        const token = await getAccessToken();
        if (token) {
          const expenseData = await fetchBarathonExpenses(barathonId, token);
          setExpenses(expenseData.expenses);
          setBalances(expenseData.balances);
          setDebts(calculateSimplifiedDebts(expenseData.balances));
        }
      } catch (err) {
        console.error('Failed to load expenses in recap:', err);
      }
    }
  }

  async function handleSearchUsers(query: string) {
    try {
      setLoadingUsers(true);

      const data = await searchUsers(query);

      const filtered = data.filter(
        (candidate) => !participants.some((participant) => participant.id === candidate.id)
      );

      setResults(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  }

  function handleAddParticipant(user: SearchUserResult) {
    if (participants.some((participant) => participant.id === user.id)) {
      return;
    }

    setParticipants((prev) => [...prev, user]);
    setSearch('');
    setResults([]);
  }

  async function handleRemoveParticipant(userId: number) {
    if (creatorUserId === userId) {
      return;
    }

    const isExisting = initialParticipantIds.includes(userId);

    if (isDetailsMode && isExisting) {
      const participant = participants.find((p) => p.id === userId);
      const username = participant?.username || 'cet utilisateur';

      Alert.alert(
        'Retirer le participant',
        `Es-tu sûr de vouloir retirer ${username} de ce barathon ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Retirer',
            style: 'destructive',
            onPress: async () => {
              try {
                setSubmitting(true);
                const updated = (await removeParticipantFromBarathon(
                  Number(params.barathonId),
                  userId
                )) as any;

                const normalizedParticipants = updated.participants.map((p: any) => p.user);
                setParticipants(normalizedParticipants);
                setInitialParticipantIds(normalizedParticipants.map((p: any) => p.id));
                Alert.alert('Succès', 'Participant retiré.');
              } catch (error) {
                Alert.alert(
                  'Erreur',
                  error instanceof Error ? error.message : "Impossible de retirer l'utilisateur."
                );
              } finally {
                setSubmitting(false);
              }
            },
          },
        ]
      );
    } else {
      setParticipants((prev) => prev.filter((participant) => participant.id !== userId));
    }
  }

  const startDate = useMemo(() => {
    if (!startDateTimeIso) {
      return null;
    }

    const parsed = new Date(startDateTimeIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [startDateTimeIso]);

  const totalBarTimeMinutes = useMemo(() => {
    return stops.length * maxTimeInBarMinutes;
  }, [stops.length, maxTimeInBarMinutes]);

  const totalTravelTimeMinutes = useMemo(() => {
    if (stops.length <= 1) {
      return 0;
    }

    return (stops.length - 1) * travelTimeBetweenBarsMinutes;
  }, [stops.length, travelTimeBetweenBarsMinutes]);

  const estimatedEndDate = useMemo(() => {
    if (!startDate) {
      return null;
    }

    const totalMinutes = totalBarTimeMinutes + totalTravelTimeMinutes;
    return new Date(startDate.getTime() + totalMinutes * 60 * 1000);
  }, [startDate, totalBarTimeMinutes, totalTravelTimeMinutes]);

  const routeCoordinates = useMemo(() => {
    return [...stops]
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      }));
  }, [stops]);

  const [streetRouteCoordinates, setStreetRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  useEffect(() => {
    let active = true;

    async function loadFullStreetRoute() {
      if (stops.length < 2) {
        setStreetRouteCoordinates([]);
        return;
      }

      const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
      const allCoords: { latitude: number; longitude: number }[] = [];

      for (let i = 0; i < sortedStops.length - 1; i++) {
        if (!active) return;
        const from = sortedStops[i];
        const to = sortedStops[i + 1];

        const seg = await fetchWalkingRoute(
          { latitude: from.latitude, longitude: from.longitude },
          { latitude: to.latitude, longitude: to.longitude }
        );

        if (active) {
          if (allCoords.length > 0) {
            allCoords.push(...seg.coordinates.slice(1));
          } else {
            allCoords.push(...seg.coordinates);
          }
        }
      }

      if (active && allCoords.length >= 2) {
        setStreetRouteCoordinates(allCoords);
      }
    }

    void loadFullStreetRoute();

    return () => {
      active = false;
    };
  }, [stops]);

  useEffect(() => {
    const coordsToFit =
      streetRouteCoordinates.length > 0 ? streetRouteCoordinates : routeCoordinates;
    if (coordsToFit.length > 0) {
      const t = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordsToFit, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [routeCoordinates, streetRouteCoordinates]);

  const initialRegion: Region = useMemo(() => {
    if (stops.length === 0) {
      return {
        latitude: 43.6047,
        longitude: 1.4442,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return {
      latitude: stops[0].latitude,
      longitude: stops[0].longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [stops]);

  const addedParticipantIds = useMemo(() => {
    return participants
      .map((participant) => participant.id)
      .filter((id) => !initialParticipantIds.includes(id));
  }, [participants, initialParticipantIds]);

  const canSubmitCreate =
    !isDetailsMode &&
    !!startDate &&
    !!estimatedEndDate &&
    stops.length >= 2 &&
    participants.length >= 1 &&
    !submitting;

  const canSubmitParticipants =
    isDetailsMode &&
    addedParticipantIds.length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (isDetailsMode) {
      await handleAddParticipantsOnExistingBarathon();
      return;
    }

    await handleCreateBarathon();
  }

  async function handleCreateBarathon() {
    if (!startDate || !estimatedEndDate) {
      Alert.alert('Erreur', 'La date de début ou de fin est invalide.');
      return;
    }

    if (stops.length < 2) {
      Alert.alert('Erreur', 'Ajoute au moins 2 étapes avant de confirmer.');
      return;
    }

    if (participants.length < 1) {
      Alert.alert('Erreur', 'Ajoute au moins un participant.');
      return;
    }

    const payload: CreateBarathonPayload = {
      name,
      start_datetime: startDate.toISOString(),
      end_datetime: estimatedEndDate.toISOString(),
      travel_time_between_bars_minutes: travelTimeBetweenBarsMinutes,
      max_time_in_bar_minutes: maxTimeInBarMinutes,
      participant_user_ids: participants.map((participant) => participant.id),
      partner_event_id: params.partnerEventId ? Number(params.partnerEventId) : null,
      stops: [...stops]
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((stop, index) => ({
          name: stop.name,
          stop_type: stop.stopType,
          latitude: stop.latitude,
          longitude: stop.longitude,
          stop_order: index + 1,
        })),
    };

    try {
      setSubmitting(true);
      await createBarathon(payload);
      Alert.alert('Succès', 'Barathon créé avec succès.');
      router.replace('/planned');
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de créer le barathon.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const handleAddParticipantsOnExistingBarathon = useCallback(async (): Promise<boolean> => {
    if (!params.barathonId) {
      Alert.alert('Erreur', 'Barathon introuvable.');
      return false;
    }

    if (addedParticipantIds.length === 0) {
      Alert.alert('Erreur', 'Aucun nouveau participant à ajouter.');
      return false;
    }

    try {
      setSubmitting(true);
      const updated = (await addParticipantsToBarathon(
        Number(params.barathonId),
       { participant_user_ids: addedParticipantIds }
      )) as ExistingBarathonDetails;

      const normalizedParticipants = updated.participants.map((participant) => participant.user);
      setParticipants(normalizedParticipants);
      setInitialParticipantIds(normalizedParticipants.map((participant) => participant.id));

      Alert.alert('Succès', 'Participants ajoutés.');
      return true;
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d’ajouter les participants.'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [params.barathonId, addedParticipantIds]);

  const handleBack = useCallback(async () => {
    if (isDetailsMode && addedParticipantIds.length > 0) {
      Alert.alert(
        'Ajouts non validés',
        "Tu as ajouté des participants mais tu n'as pas validé l'ajout. Que souhaites-tu faire ?",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ne pas ajouter',
            style: 'destructive',
            onPress: () => {
              router.back();
            },
          },
          {
            text: "Valider l'ajout",
            onPress: async () => {
              const success = await handleAddParticipantsOnExistingBarathon();
              if (success) {
                router.back();
              }
            },
          },
        ]
      );
    } else {
      router.back();
    }
  }, [isDetailsMode, addedParticipantIds, handleAddParticipantsOnExistingBarathon]);

  useEffect(() => {
    const backAction = () => {
      if (isDetailsMode && addedParticipantIds.length > 0) {
        handleBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isDetailsMode, addedParticipantIds, handleBack]);

  if (loadingBarathon) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>

          {!isDetailsMode && (
            <View style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2563EB' }} />
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2563EB' }} />
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2563EB' }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Étape 3 sur 3 • Récapitulatif & Finalisation
              </Text>
            </View>
          )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Nom</Text>
            <Text style={styles.value}>{name}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date de début</Text>
            <Text style={styles.value}>
              {startDate ? startDate.toLocaleDateString('fr-FR') : '--/--/----'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Heure de début</Text>
            <Text style={styles.value}>
              {startDate
                ? startDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--:--'}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.label}>Date de fin estimée</Text>
            <Text style={styles.value}>
              {estimatedEndDate
                ? estimatedEndDate.toLocaleDateString('fr-FR')
                : '--/--/----'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Heure de fin estimée</Text>
            <Text style={styles.value}>
              {estimatedEndDate
                ? estimatedEndDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--:--'}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.label}>Temps total dans les bars</Text>
            <Text style={styles.value}>{totalBarTimeMinutes} min</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Temps total de trajet</Text>
            <Text style={styles.value}>{totalTravelTimeMinutes} min</Text>
          </View>

          {status ? (
            <View style={styles.row}>
              <Text style={styles.label}>Statut</Text>
              <Text style={styles.value}>{status}</Text>
            </View>
          ) : null}
        </View>

        {/* Card Dépenses & Compensations */}
        {isDetailsMode && (status === 'completed' || status === 'started') && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="wallet-outline" size={20} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: '#10B981', marginBottom: 0 }]}>Comptes du Barathon</Text>
            </View>

            {expenses.length === 0 ? (
              <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center', marginVertical: 12 }}>
                {"Aucune dépense n'a été enregistrée pour ce barathon."}
              </Text>
            ) : (
              <View>
                {/* Section Compensations */}
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>
                  Équilibre des remboursements
                </Text>

                {debts.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                    <Text style={{ color: '#10B981', fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 }}>
                      Toutes les dépenses sont parfaitement équilibrées ! Aucun remboursement nécessaire.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginBottom: 20 }}>
                    {debts.map((debt, index) => {
                      const isMeDebtor = currentUser && debt.debtorId === currentUser.id;
                      const isMeCreditor = currentUser && debt.creditorId === currentUser.id;

                      if (isMeDebtor) {
                        return (
                          <View
                            key={index}
                            style={{
                              padding: 14,
                              borderRadius: 14,
                              backgroundColor: '#FEF2F2',
                              borderWidth: 1,
                              borderColor: '#FCA5A5',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                              <Text style={{ fontWeight: '700', color: '#B91C1C', fontSize: 14 }}>
                                Tu dois à {debt.creditorName}
                              </Text>
                            </View>
                            <Text style={{ fontWeight: '900', color: '#B91C1C', fontSize: 16 }}>
                              {debt.amount.toFixed(2)} €
                            </Text>
                          </View>
                        );
                      }

                      if (isMeCreditor) {
                        return (
                          <View
                            key={index}
                            style={{
                              padding: 14,
                              borderRadius: 14,
                              backgroundColor: '#F0FDF4',
                              borderWidth: 1,
                              borderColor: '#86EFAC',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <Ionicons name="gift-outline" size={16} color="#15803D" />
                              <Text style={{ fontWeight: '700', color: '#15803D', fontSize: 14 }}>
                                {debt.debtorName} te doit
                              </Text>
                            </View>
                            <Text style={{ fontWeight: '900', color: '#15803D', fontSize: 16 }}>
                              {debt.amount.toFixed(2)} €
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={index}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            backgroundColor: '#F9FAFB',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontWeight: '600', color: '#4B5563', fontSize: 14 }}>
                            {debt.debtorName} doit à {debt.creditorName}
                          </Text>
                          <Text style={{ fontWeight: '800', color: '#4B5563', fontSize: 15 }}>
                            {debt.amount.toFixed(2)} €
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.separator} />

                {/* Section Historique des dépenses */}
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 12, marginBottom: 12 }}>
                  Historique des dépenses ({expenses.length})
                </Text>
                <View style={{ gap: 8 }}>
                  {expenses.map((exp) => (
                    <View
                      key={exp.id}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: '#F9FAFB',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>
                          {exp.description || 'Dépense partagée'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                          Payé par {exp.payer_username} • {exp.beneficiary_user_ids.length} pers.
                        </Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#10B981' }}>
                        {exp.amount.toFixed(2)} €
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Participants</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un utilisateur"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />

          {loadingUsers ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator />
            </View>
          ) : null}

          {results.map((user) => (
            <TouchableOpacity
              key={user.id}
              onPress={() => handleAddParticipant(user)}
              style={styles.searchResultCard}
            >
              <Text style={styles.searchResultUsername}>{user.username}</Text>
            </TouchableOpacity>
          ))}

          {results.length === 0 && search.trim().length > 0 && !loadingUsers ? (
            <Text style={styles.emptyText}>Aucun utilisateur trouvé.</Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            {participants.map((participant) => (
              <View key={participant.id} style={styles.participantCard}>
                <View style={styles.participantHeader}>
                  <Text style={styles.participantUsername}>{participant.username}</Text>

                  {creatorUserId === participant.id ? (
                    <Text style={styles.creatorBadge}>Créateur</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleRemoveParticipant(participant.id)}
                    >
                      <Text style={styles.removeText}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Parcours ({stops.length} étapes)</Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
              activeOpacity={0.8}
              onPress={() => setIsMapExpanded((prev) => !prev)}
            >
              <Ionicons name={isMapExpanded ? 'contract-outline' : 'expand-outline'} size={14} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>
                {isMapExpanded ? 'Réduire' : 'Agrandir la carte'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.mapWrapper, isMapExpanded && { height: 420 }]}>
            <MapView
              ref={mapRef}
              style={[styles.mapPreview, isMapExpanded && { height: 420 }]}
              initialRegion={initialRegion}
              scrollEnabled={true}
              zoomEnabled={true}
              rotateEnabled={true}
              pitchEnabled={false}
              toolbarEnabled={false}
            >
              {(streetRouteCoordinates.length >= 2 ? streetRouteCoordinates : routeCoordinates).length >= 2 ? (
                <>
                  <Polyline
                    key="recap-glow-polyline"
                    coordinates={streetRouteCoordinates.length >= 2 ? streetRouteCoordinates : routeCoordinates}
                    strokeWidth={8}
                    strokeColor="rgba(16, 185, 129, 0.25)"
                  />
                  <Polyline
                    key="recap-polyline"
                    coordinates={streetRouteCoordinates.length >= 2 ? streetRouteCoordinates : routeCoordinates}
                    strokeWidth={4}
                    strokeColor="#10B981"
                  />
                </>
              ) : null}

              {[...stops]
                .sort((a, b) => a.stopOrder - b.stopOrder)
                .map((stop, index) => {
                  const isBar = stop.stopType === 'bar';
                  const pinBgColor = isBar ? '#D97706' : '#DC2626';
                  return (
                    <Marker
                      key={stop.id}
                      coordinate={{
                        latitude: stop.latitude,
                        longitude: stop.longitude,
                      }}
                      anchor={{ x: 0.5, y: 1.0 }}
                      tracksViewChanges={false}
                      title={`Étape ${index + 1} - ${stop.name}`}
                      description={`${isBar ? 'Bar' : 'Restaurant'} • Étape`}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: pinBgColor,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: '#FFFFFF',
                            shadowColor: '#000',
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 4,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>
                            {index + 1}
                          </Text>
                          <Ionicons name={isBar ? 'beer' : 'restaurant'} size={11} color="#FFFFFF" />
                        </View>
                        <View
                          style={{
                            width: 0,
                            height: 0,
                            borderStyle: 'solid',
                            borderLeftWidth: 4,
                            borderRightWidth: 4,
                            borderTopWidth: 5,
                            borderLeftColor: 'transparent',
                            borderRightColor: 'transparent',
                            borderTopColor: pinBgColor,
                            marginTop: -1,
                          }}
                        />
                      </View>
                    </Marker>
                  );
                })}
            </MapView>

            {/* Floating Zoom Controls */}
            <View style={{ position: 'absolute', right: 10, bottom: 10, gap: 6, zIndex: 10 }}>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.85}
                onPress={() => {
                  if (mapRef.current) {
                    mapRef.current.getCamera().then((cam) => {
                      if (cam.altitude) {
                        mapRef.current?.animateCamera({ altitude: Math.max(100, cam.altitude * 0.5) }, { duration: 250 });
                      } else {
                        mapRef.current?.animateToRegion({
                          latitude: initialRegion.latitude,
                          longitude: initialRegion.longitude,
                          latitudeDelta: Math.max(0.002, initialRegion.latitudeDelta * 0.5),
                          longitudeDelta: Math.max(0.002, initialRegion.longitudeDelta * 0.5),
                        }, 250);
                      }
                    }).catch(() => {});
                  }
                }}
              >
                <Ionicons name="add" size={20} color="#111827" />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.85}
                onPress={() => {
                  if (mapRef.current) {
                    mapRef.current.getCamera().then((cam) => {
                      if (cam.altitude) {
                        mapRef.current?.animateCamera({ altitude: cam.altitude * 2 }, { duration: 250 });
                      } else {
                        mapRef.current?.animateToRegion({
                          latitude: initialRegion.latitude,
                          longitude: initialRegion.longitude,
                          latitudeDelta: initialRegion.latitudeDelta * 2,
                          longitudeDelta: initialRegion.longitudeDelta * 2,
                        }, 250);
                      }
                    }).catch(() => {});
                  }
                }}
              >
                <Ionicons name="remove" size={20} color="#111827" />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.85}
                onPress={() => {
                  if (mapRef.current && stops.length > 0) {
                    mapRef.current.fitToCoordinates(
                      stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
                      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true }
                    );
                  }
                }}
              >
                <Ionicons name="scan-outline" size={17} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 6 }}>
            Pincez l'écran ou utilisez les boutons + / - pour zoomer sur le trajet piéton.
          </Text>

          <View style={styles.stopList}>
            {[...stops]
              .sort((a, b) => a.stopOrder - b.stopOrder)
              .map((stop, index) => {
                const isBar = stop.stopType === 'bar';
                return (
                  <View key={stop.id} style={styles.stopCard}>
                    <Text style={styles.stopIndex}>Étape {index + 1}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                      <Text style={[styles.stopName, { flex: 1, marginTop: 0 }]}>{stop.name}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: isBar ? '#FEF3C7' : '#FEE2E2',
                          borderColor: isBar ? '#FCD34D' : '#FCA5A5',
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Ionicons
                          name={isBar ? 'beer' : 'restaurant'}
                          size={12}
                          color={isBar ? '#92400E' : '#991B1B'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isBar ? '#92400E' : '#991B1B',
                          }}
                        >
                          {isBar ? 'Bar' : 'Restaurant'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                      Arrêt n°{index + 1} • {isBar ? 'Bar' : 'Restaurant'}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            !canSubmitCreate && !canSubmitParticipants && styles.submitButtonDisabled,
          ]}
          disabled={!canSubmitCreate && !canSubmitParticipants}
        >
          <Text style={styles.submitButtonText}>
            {submitting
              ? 'Traitement...'
              : isDetailsMode
              ? 'Ajouter les participants'
              : 'Confirmer le barathon'}
          </Text>
        </TouchableOpacity>

        {!isDetailsMode && !canSubmitCreate ? (
          <Text style={styles.helperText}>
            Il faut au moins 2 étapes et 1 participant pour confirmer.
          </Text>
        ) : null}

        {isDetailsMode && !canSubmitParticipants ? (
          <Text style={styles.helperText}>
            Ajoute au moins un nouveau participant pour valider.
          </Text>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
