import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { styles } from '../styles/barathonStopSummary.styles';
import { fetchBarathonExpenses } from '../../../lib/api';
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
          const expenseData = await fetchBarathonExpenses(Number(params.barathonId), token);
          setExpenses(expenseData.expenses);
          setBalances(expenseData.balances);
          setDebts(calculateSimplifiedDebts(expenseData.balances));
        }
      }
    } catch (err) {
      console.error('Failed to load expenses or user in summary:', err);
    }
  }

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

        {/* Card Dépenses & Compensations */}
        {expenses.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { color: '#10B981', marginBottom: 16 }]}>💰 Comptes du Barathon</Text>

            {/* Section Compensations */}
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>
              Équilibre des remboursements
            </Text>

            {debts.length === 0 ? (
              <Text style={{ color: '#10B981', fontSize: 14, fontWeight: '700', marginBottom: 16, lineHeight: 20 }}>
                ✓ Toutes les dépenses sont parfaitement équilibrées ! Aucun remboursement nécessaire.
              </Text>
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
                        <Text style={{ fontWeight: '700', color: '#B91C1C', fontSize: 14 }}>
                          ⚠️ Tu dois à {debt.creditorName}
                        </Text>
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
                        <Text style={{ fontWeight: '700', color: '#15803D', fontSize: 14 }}>
                          🎉 {debt.debtorName} te doit
                        </Text>
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

            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 14 }} />

            {/* Section Historique des dépenses */}
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>
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
