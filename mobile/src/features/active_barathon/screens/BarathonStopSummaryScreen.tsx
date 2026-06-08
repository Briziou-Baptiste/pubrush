import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { styles } from '../styles/barathonStopSummary.styles';
import { fetchBarathonExpenses, savePastBarathon, createBarathonExpense, fetchBarathon } from '../../../lib/api';
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

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
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
            } catch (err) {
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

  async function loadUserDataAndExpenses() {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }

      if (params.barathonId) {
        const token = await getAccessToken();
        if (token) {
          // 1. Fetch expenses
          const expenseData = await fetchBarathonExpenses(Number(params.barathonId), token);
          setExpenses(expenseData.expenses);
          setBalances(expenseData.balances);
          setDebts(calculateSimplifiedDebts(expenseData.balances));

          // 2. Fetch details to populate stops and metadata if missing or to ensure up-to-date values
          try {
            const details = await fetchBarathon(Number(params.barathonId), token);
            if (details) {
              setBarathonName(details.name);
              setStops(details.stops || []);
              setTotalStops((details.stops || []).length);
              setCompletedStops((details.stops || []).filter((s: any) => s.is_completed).length);
              setStartDateTimeIso(details.start_datetime);
              setEndDateTimeIso(details.ended_at || details.end_datetime);
            }
          } catch (err) {
            console.error('Failed to load barathon details in summary:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load expenses or user in summary:', err);
    }
  }

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
    if (!startDateTimeIso || !endDateTimeIso) {
      return '--';
    }

    const start = new Date(startDateTimeIso);
    const end = new Date(endDateTimeIso);

    const diffMs = end.getTime() - start.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}min`;
  }, [startDateTimeIso, endDateTimeIso]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Barathon arrêté</Text>
          <Text style={styles.subtitle}>{barathonName}</Text>
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

        {/* Card Dépenses & Compensations */}
        {expenses.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { color: '#10B981', marginBottom: 16 }]}>💰 Comptes du Barathon</Text>

            {/* Section Compensations */}
            <Text style={styles.sectionTitle}>
              Équilibre des remboursements
            </Text>

            {debts.length === 0 ? (
              <Text style={styles.successText}>
                ✓ Toutes les dépenses sont parfaitement équilibrées ! Aucun remboursement nécessaire.
              </Text>
            ) : (
              <View style={{ gap: 8, marginBottom: 20 }}>
                {debts.map((debt, index) => {
                  const isMeDebtor = currentUser && debt.debtorId === currentUser.id;
                  const isMeCreditor = currentUser && debt.creditorId === currentUser.id;

                  if (isMeDebtor) {
                    return (
                      <View key={index} style={styles.debtorCard}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.debtorText}>
                            ⚠️ Tu dois à {debt.creditorName}
                          </Text>
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
                        <Text style={styles.creditorText}>
                          🎉 {debt.debtorName} te doit
                        </Text>
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
                    <Text style={[styles.expenseAmount, isRefund && { color: '#15803D' }]}>
                      {isRefund ? `✓ ${exp.amount.toFixed(2)} €` : `${exp.amount.toFixed(2)} €`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {params.barathonId && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#2563EB', marginBottom: 12 }]}
            onPress={() => {
              setSaveName(barathonName || params.barathonName || '');
              setIsSaveModalVisible(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Enregistrer ce barathon</Text>
          </TouchableOpacity>
        )}

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

      <Modal
        visible={isSaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSaveModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Nommer le barathon enregistré</Text>
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
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setIsSaveModalVisible(false);
                    setSaveError('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
