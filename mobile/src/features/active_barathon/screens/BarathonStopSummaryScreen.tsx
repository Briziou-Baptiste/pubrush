import { useNavigation, useLocalSearchParams } from 'expo-router';
import { navigationControlStyles } from '../../../lib/navigation.styles';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { summaryHistory } from '../../../lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/barathonStopSummary.styles';
import { fetchBarathonExpenses, savePastBarathon, createBarathonExpense, fetchBarathon } from '../../../lib/api';
import { getBarathonOutcome } from '../../barathon_past_planned/utils/barathon.status';
import { getAccessToken, getCurrentUser } from '../../../lib/authStorage';

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

type Stop = {
  id: number;
  name: string;
  stop_type: 'bar' | 'food';
  latitude: number;
  longitude: number;
  stop_order: number;
  is_completed?: boolean;
};

export default function BarathonStopSummaryScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  useEffect(() => {
    const state = navigation.getState();
    if (!state) return;
    const current = state.routes[state.index];
    const routes = summaryHistory(state.routes, current);
    if (routes !== state.routes) navigation.reset({ index: routes.length - 1, routes });
  }, [navigation]);

  const params = useLocalSearchParams<{
    barathonId?: string;
    barathonName?: string;
    totalStops?: string;
    completedStops?: string;
    startDateTimeIso?: string;
    endDateTimeIso?: string;
    stopsJson?: string;
    source?: string;
    status?: string;
  }>();

  const [barathonStatus, setBarathonStatus] = useState<string | undefined>(params.status);
  const [detailsError, setDetailsError] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<DebtSettlement[]>([]);

  // Barathon details states loaded dynamically or from params
  const [stops, setStops] = useState<Stop[]>(() => {
    if (params.stopsJson) {
      try {
        const parsed = JSON.parse(params.stopsJson);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [totalStops, setTotalStops] = useState<number>(() => Number(params.totalStops ?? 0));
  const [completedStops, setCompletedStops] = useState<number>(() => Number(params.completedStops ?? 0));
  const [barathonName, setBarathonName] = useState<string>(() => params.barathonName ?? 'Barathon');
  const [startDateTimeIso, setStartDateTimeIso] = useState<string | undefined>(() => params.startDateTimeIso);
  const [endDateTimeIso, setEndDateTimeIso] = useState<string | undefined>(() => params.endDateTimeIso);

  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleConfirmSave() {
    if (!saveName.trim()) {
      setSaveError('Le nom ne peut pas être vide.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError('');
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
        return;
      }
      await savePastBarathon(Number(params.barathonId), saveName.trim(), token);
      setIsSaveModalVisible(false);
      Alert.alert('Succès', 'Barathon enregistré avec succès !');
    } catch (err) {
      console.error('[Summary] Error saving barathon:', err);
      setSaveError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSettleDebt(debt: DebtSettlement) {
    Alert.alert(
      'Enregistrer le remboursement',
      `Confirmez-vous avoir remboursé ${debt.amount.toFixed(2)} € à ${debt.creditorName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'default',
          onPress: async () => {
            try {
              const token = await getAccessToken();
              if (!token || !params.barathonId) return;

              await createBarathonExpense(
                Number(params.barathonId),
                {
                  payer_user_id: debt.debtorId,
                  amount: debt.amount,
                  description: `Remboursement à ${debt.creditorName}`,
                  beneficiary_user_ids: [debt.creditorId],
                  is_refund: true,
                },
                token
              );

              Alert.alert('Succès', 'Le remboursement a bien été enregistré.');
              void loadUserDataAndExpenses();
            } catch {
              Alert.alert('Erreur', "Impossible d'enregistrer le remboursement.");
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    void loadUserDataAndExpenses();
  }, [params.barathonId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let devMenu: any = null;
    try {
      devMenu = require('expo-dev-menu');
      if (devMenu && typeof devMenu.setToolsButtonVisible === 'function') {
        devMenu.setToolsButtonVisible(false);
      }
    } catch {
      // expo-dev-menu not installed, production build, or native module unavailable
    }

    return () => {
      if (Platform.OS === 'web') return;
      try {
        if (devMenu && typeof devMenu.setToolsButtonVisible === 'function') {
          devMenu.setToolsButtonVisible(true);
        }
      } catch {}
    };
  }, []);

  async function loadUserDataAndExpenses() {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }

      if (params.barathonId) {
        const token = await getAccessToken();
        if (token) {
          // Load details independently: an expenses failure must not hide the result.
          const [detailsResult, expensesResult] = await Promise.allSettled([
            fetchBarathon(Number(params.barathonId), token),
            fetchBarathonExpenses(Number(params.barathonId), token),
          ]);
          if (detailsResult.status === 'fulfilled' && detailsResult.value) {
            const details = detailsResult.value;
            setBarathonStatus(details.status);
            setDetailsError(false);
            setBarathonName(details.name);
            setStops(details.stops || []);
            setTotalStops((details.stops || []).length);
            setCompletedStops((details.stops || []).filter((s: any) => s.is_completed).length);

            const realStart = details.started_at || details.start_datetime;
            const realEnd =
              details.ended_at ||
              (details.end_datetime && details.end_datetime !== details.start_datetime
                ? details.end_datetime
                : undefined);
            if (realStart) setStartDateTimeIso(realStart);
            if (realEnd) setEndDateTimeIso(realEnd);
          } else {
            setDetailsError(true);
          }
          if (expensesResult.status === 'fulfilled') {
            const expenseData = expensesResult.value;
            setExpenses(expenseData.expenses);
            setDebts(calculateSimplifiedDebts(expenseData.balances));
          }
        } else {
          setDetailsError(true);
        }
      }
    } catch (err) {
      setDetailsError(true);
      console.error('Failed to load expenses or user in summary:', err);
    }
  }

  const completedPercentage = totalStops > 0
    ? Math.round((completedStops / totalStops) * 100)
    : 0;

  const progressFillColor =
    completedPercentage >= 70
      ? '#10B981'
      : completedPercentage >= 40
      ? '#F59E0B'
      : '#EF4444';

  const percentageStyle =
    completedPercentage >= 70
      ? styles.greenText
      : completedPercentage >= 40
      ? styles.orangeText
      : styles.redText;

  const durationText = useMemo(() => {
    if (!startDateTimeIso || !endDateTimeIso) {
      return 'Non disponible';
    }

    const start = new Date(startDateTimeIso);
    const end = new Date(endDateTimeIso);

    const startMs = start.getTime();
    const endMs = end.getTime();

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      return 'Non disponible';
    }

    const diffMs = endMs - startMs;
    const totalMinutes = Math.floor(diffMs / 60000);

    // If completed steps exist but recorded duration is 0, timestamps are non-representative
    if (totalMinutes === 0 && completedStops > 0) {
      return 'Non disponible';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }
    return `${hours}h ${minutes}min`;
  }, [startDateTimeIso, endDateTimeIso, completedStops]);

  const totalDistanceKm = useMemo(() => {
    if (stops.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const lat1 = Number(stops[i].latitude);
      const lon1 = Number(stops[i].longitude);
      const lat2 = Number(stops[i + 1].latitude);
      const lon2 = Number(stops[i + 1].longitude);
      if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) continue;
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      d += R * c;
    }
    return Number(d.toFixed(1));
  }, [stops]);

  const outcome = getBarathonOutcome(barathonStatus, stops);

  const statusConfig = useMemo(() => {
    switch (barathonStatus) {
      case 'completed':
        return {
          icon: 'checkmark-circle' as const,
          color: '#15803D',
          badgeStyle: styles.statusBadgeCompleted,
          textStyle: styles.statusTextCompleted,
        };
      case 'stopped':
        return {
          icon: 'stop-circle-outline' as const,
          color: '#B45309',
          badgeStyle: styles.statusBadgeStopped,
          textStyle: styles.statusTextStopped,
        };
      case 'planned':
        return {
          icon: 'calendar-outline' as const,
          color: '#1D4ED8',
          badgeStyle: styles.statusBadgePlanned,
          textStyle: styles.statusTextPlanned,
        };
      case 'started':
        return {
          icon: 'play-circle-outline' as const,
          color: '#7E22CE',
          badgeStyle: styles.statusBadgeStarted,
          textStyle: styles.statusTextStarted,
        };
      case 'failed':
        return {
          icon: 'alert-circle-outline' as const,
          color: '#B91C1C',
          badgeStyle: styles.statusBadgeFailed,
          textStyle: styles.statusTextFailed,
        };
      default:
        return {
          icon: 'help-circle-outline' as const,
          color: '#4B5563',
          badgeStyle: styles.statusBadgeDefault,
          textStyle: styles.statusTextDefault,
        };
    }
  }, [barathonStatus]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Card moderne et explicite */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{barathonName}</Text>

          <View style={[styles.statusBadge, statusConfig.badgeStyle]}>
            <Ionicons name={statusConfig.icon} size={15} color={statusConfig.color} />
            <Text style={[styles.statusBadgeText, statusConfig.textStyle]}>
              {`Statut : ${outcome.label}`}
            </Text>
          </View>

          <View style={styles.progressionSection}>
            <View style={styles.progressionRow}>
              <Text style={styles.progressionLabel}>
                {outcome.targetReached === null
                  ? 'Étapes indisponibles'
                  : `${completedStops} ${completedStops > 1 ? 'étapes' : 'étape'} sur ${totalStops} — ${completedPercentage} %`}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.max(0, completedPercentage))}%`,
                    backgroundColor: progressFillColor,
                  },
                ]}
              />
            </View>

            <View style={styles.targetRow}>
              <Ionicons
                name={
                  outcome.targetReached === null
                    ? 'information-circle-outline'
                    : outcome.targetReached
                    ? 'checkmark-circle'
                    : 'close-circle-outline'
                }
                size={16}
                color={
                  outcome.targetReached === null
                    ? '#6B7280'
                    : outcome.targetReached
                    ? '#059669'
                    : '#D97706'
                }
              />
              <Text
                style={[
                  styles.targetText,
                  outcome.targetReached === null
                    ? styles.targetTextUnknown
                    : outcome.targetReached
                    ? styles.targetTextSuccess
                    : styles.targetTextMissed,
                ]}
              >
                {outcome.progressLabel}
              </Text>
            </View>
          </View>

          {detailsError && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
              <Text style={styles.warningText}>
                Actualisation impossible. Le résultat affiché peut être incomplet.
              </Text>
            </View>
          )}
        </View>

        {/* Résumé Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Résumé</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="flag-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.summaryTextGroup}>
                <Text style={styles.summaryLabel}>Étapes réalisées</Text>
                <Text style={[styles.summaryValue, percentageStyle]}>
                  {outcome.targetReached === null
                    ? 'Données incomplètes'
                    : `${completedStops} / ${totalStops} (${completedPercentage}%)`}
                </Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="time-outline" size={18} color="#16A34A" />
              </View>
              <View style={styles.summaryTextGroup}>
                <Text style={styles.summaryLabel}>Temps passé</Text>
                <Text style={styles.summaryValue}>{durationText}</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="navigate-outline" size={18} color="#D97706" />
              </View>
              <View style={styles.summaryTextGroup}>
                <Text style={styles.summaryLabel}>Distance estimée (vol d’oiseau)</Text>
                <Text style={styles.summaryValue}>
                  {totalDistanceKm > 0 ? `~${totalDistanceKm} km` : 'Non disponible'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Liste des Étapes */}
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Étapes</Text>
            {stops.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{stops.length}</Text>
              </View>
            )}
          </View>

          {stops.length === 0 ? (
            <Text style={styles.emptyStopsText}>Aucune étape enregistrée.</Text>
          ) : (
            stops.map((stop, index) => {
              const isDone = stop.is_completed;
              const isKnown = typeof isDone === 'boolean';

              return (
                <View key={stop.id} style={styles.stopRow}>
                  <View
                    style={[
                      styles.stopNumberBadge,
                      !isKnown
                        ? styles.stopNumberBadgeUnknown
                        : isDone
                        ? styles.stopNumberBadgeDone
                        : styles.stopNumberBadgeNotDone,
                    ]}
                  >
                    <Ionicons
                      name={
                        !isKnown
                          ? 'help'
                          : isDone
                          ? 'checkmark'
                          : 'close'
                      }
                      size={15}
                      color={
                        !isKnown
                          ? '#6B7280'
                          : isDone
                          ? '#15803D'
                          : '#DC2626'
                      }
                    />
                  </View>

                  <View style={styles.stopTextBlock}>
                    <Text style={styles.stopName}>
                      Étape {index + 1} — {stop.name}
                    </Text>
                    <Text style={styles.stopType}>
                      {stop.stop_type === 'bar' ? 'Bar' : 'Restaurant'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.stopStatusBadge,
                      !isKnown
                        ? styles.stopStatusBadgeUnknown
                        : isDone
                        ? styles.stopStatusBadgeDone
                        : styles.stopStatusBadgeNotDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopStatusText,
                        !isKnown
                          ? styles.stopStatusTextUnknown
                          : isDone
                          ? styles.stopStatusTextDone
                          : styles.stopStatusTextNotDone,
                      ]}
                    >
                      {!isKnown ? 'Inconnu' : isDone ? 'Fait' : 'Non fait'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Card Dépenses & Compensations */}
        {expenses.length > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="wallet-outline" size={22} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: '#10B981', marginBottom: 0 }]}>Comptes du Barathon</Text>
            </View>

            {/* Section Compensations */}
            <Text style={styles.sectionTitle}>
              Équilibre des remboursements
            </Text>

            {debts.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={[styles.successText, { flex: 1 }]}>
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
                      <View key={index} style={styles.debtorCard}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                            <Text style={styles.debtorText}>
                              Tu dois à {debt.creditorName}
                            </Text>
                          </View>
                          <Text style={styles.debtorAmount}>
                            {debt.amount.toFixed(2)} €
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#B91C1C',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                          }}
                          onPress={() => handleSettleDebt(debt)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                            Rembourser
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (isMeCreditor) {
                    return (
                      <View key={index} style={styles.creditorCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="gift-outline" size={16} color="#059669" />
                          <Text style={styles.creditorText}>
                            {debt.debtorName} te doit
                          </Text>
                        </View>
                        <Text style={styles.creditorAmount}>
                          {debt.amount.toFixed(2)} €
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View key={index} style={styles.neutralCard}>
                      <Text style={styles.neutralText}>
                        {debt.debtorName} doit à {debt.creditorName}
                      </Text>
                      <Text style={styles.neutralAmount}>
                        {debt.amount.toFixed(2)} €
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 14 }} />

            {/* Section Historique des dépenses */}
            <Text style={styles.sectionTitle}>
              Historique des dépenses ({expenses.length})
            </Text>
            <View style={{ gap: 8 }}>
              {expenses.map((exp) => {
                const isRefund = exp.is_refund;
                return (
                  <View
                    key={exp.id}
                    style={[
                      styles.neutralCard,
                      isRefund && { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
                    ]}
                  >
                    <View style={styles.expenseTextContainer}>
                      <Text style={[styles.expenseTitle, isRefund && { color: '#15803D' }]}>
                        {exp.description || (isRefund ? 'Remboursement' : 'Dépense partagée')}
                      </Text>
                      <Text style={styles.expenseSub}>
                        {isRefund
                          ? `Remboursement de ${exp.payer_username}`
                          : `Payé par ${exp.payer_username} • ${exp.beneficiary_user_ids.length} pers.`}
                      </Text>
                    </View>
                    {isRefund ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="checkmark" size={15} color="#15803D" />
                        <Text style={[styles.expenseAmount, { color: '#15803D' }]}>
                          {exp.amount.toFixed(2)} €
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.expenseAmount}>
                        {exp.amount.toFixed(2)} €
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Bouton d'enregistrement avec icône et espacement soigné */}
        {params.barathonId && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setSaveName(barathonName || params.barathonName || '');
              setIsSaveModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Enregistrer ce barathon</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={isSaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isSaving) setIsSaveModalVisible(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={navigationControlStyles.row}>
                <View style={navigationControlStyles.title}>
                  <Text style={styles.modalTitle}>Nommer le barathon enregistré</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => { if (!isSaving) setIsSaveModalVisible(false); }} disabled={isSaving} style={navigationControlStyles.close}>
                  <Ionicons name="close" size={22} color="#4B5563" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Ma tournée d'anniversaire"
                value={saveName}
                onChangeText={setSaveName}
                placeholderTextColor="#9CA3AF"
              />
              {saveError ? <Text style={styles.modalErrorText}>{saveError}</Text> : null}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleConfirmSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalButtonConfirmText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
