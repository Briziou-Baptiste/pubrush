import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { fetchBarathonExpenses, createBarathonExpense } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';
import { styles } from '../styles/activeBarathon.styles';

type ExpenseItem = {
  id: number;
  payer_user_id: number;
  payer_username: string;
  amount: number;
  description: string | null;
  beneficiary_user_ids: number[];
  created_at: string;
};

type BalanceItem = {
  user_id: number;
  username: string;
  paid_amount: number;
  debt_amount: number;
  balance: number;
};

export default function BarathonExpensesScreen() {
  const params = useLocalSearchParams<{ barathonId?: string; currentStopName?: string }>();
  const barathonId = Number(params.barathonId ?? '0');
  const currentStopName = params.currentStopName ?? '';

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState<number | null>(null);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadExpenses();
  }, [barathonId]);

  async function loadExpenses() {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Token de connexion introuvable.');
      }

      const data = await fetchBarathonExpenses(barathonId, token);
      setExpenses(data.expenses);
      setBalances(data.balances);

      // Pre-select default values for form
      if (data.balances.length > 0) {
        setPayerId(data.balances[0].user_id);
        setSelectedBeneficiaries(data.balances.map((b: any) => b.user_id));
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de charger les dépenses.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleToggleBeneficiary(userId: number) {
    setSelectedBeneficiaries((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function handleSelectAllBeneficiaries() {
    if (selectedBeneficiaries.length === balances.length) {
      setSelectedBeneficiaries([]);
    } else {
      setSelectedBeneficiaries(balances.map((b) => b.user_id));
    }
  }

  async function handleAddExpense() {
    const floatAmount = parseFloat(amount);
    if (Number.isNaN(floatAmount) || floatAmount <= 0) {
      Alert.alert('Montant invalide', 'Saisis un montant supérieur à 0.');
      return;
    }

    if (!payerId) {
      Alert.alert('Payeur requis', 'Sélectionne la personne qui a payé.');
      return;
    }

    if (selectedBeneficiaries.length === 0) {
      Alert.alert('Bénéficiaires requis', 'Sélectionne au moins un bénéficiaire.');
      return;
    }

    try {
      setSaving(true);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Session expirée.');
      }

      await createBarathonExpense(
        barathonId,
        {
          payer_user_id: payerId,
          amount: floatAmount,
          description: currentStopName.trim() || undefined,
          beneficiary_user_ids: selectedBeneficiaries,
        },
        token
      );

      // Reset form
      setAmount('');
      setModalVisible(false);

      // Reload
      await loadExpenses();
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d’enregistrer la dépense.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ flex: 1, padding: 16 }}>
        {/* Back and Header */}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#6B7280' }}>← Retour</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { fontSize: 24, marginBottom: 16 }]}>💰 Dépenses du Barathon</Text>

        {/* List of Balances */}
        <View style={styles.balanceCard}>
          <Text style={[styles.panelTitle, { marginBottom: 12 }]}>Balances des participants</Text>
          {balances.map((item) => {
            const isPos = item.balance > 0;
            const isNeg = item.balance < 0;
            const valStyle = isPos
              ? styles.balancePositive
              : isNeg
              ? styles.balanceNegative
              : styles.balanceNeutral;

            return (
              <View key={item.user_id} style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceName}>{item.username}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    Payé : {item.paid_amount.toFixed(2)} €  |  Part : {item.debt_amount.toFixed(2)} €
                  </Text>
                </View>
                <Text style={valStyle}>
                  {isPos ? '+' : ''}
                  {item.balance.toFixed(2)} €
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.panelTitle, { marginBottom: 10 }]}>Historique des dépenses</Text>

        {/* Expenses History */}
        <FlatList
          data={expenses}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>
                  {item.description || 'Dépense partagée'}
                </Text>
                <Text style={styles.expenseSub}>
                  Payé par {item.payer_username} pour {item.beneficiary_user_ids.length} pers.
                </Text>
              </View>
              <Text style={styles.expenseAmountText}>{item.amount.toFixed(2)} €</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 24 }}>
              Aucune dépense enregistrée pour le moment.
            </Text>
          }
        />

        {/* Add Expense Trigger */}
        <TouchableOpacity
          style={[styles.expensesButton, { height: 50, marginTop: 12 }]}
          activeOpacity={0.85}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.expensesButtonText, { fontSize: 16 }]}>+ Ajouter une dépense</Text>
        </TouchableOpacity>
      </View>

      {/* Add Expense Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.stopModalOverlay}>
          <View style={[styles.stopModalCard, { maxHeight: '90%', paddingBottom: 24 }]}>
            <Text style={[styles.stopModalTitle, { marginBottom: 16 }]}>Nouvelle Dépense</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Amount input */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.label}>Montant total (€)</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  style={styles.input}
                />
              </View>

              {/* Auto-assigned description display */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.label}>Description (Etape en cours)</Text>
                <View style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 6,
                  backgroundColor: '#F3F4F6',
                }}>
                  <Text style={{ fontSize: 15, color: '#4B5563', fontWeight: '600' }}>
                    {currentStopName || 'Dépense partagée'}
                  </Text>
                </View>
              </View>

              {/* Payer selection */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.label}>Qui a payé ?</Text>
                <View style={{ gap: 8, marginTop: 4 }}>
                  {balances.map((item) => (
                    <TouchableOpacity
                      key={item.user_id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: payerId === item.user_id ? '#EFF6FF' : '#F9FAFB',
                        borderWidth: 1,
                        borderColor: payerId === item.user_id ? '#3B82F6' : '#E5E7EB',
                      }}
                      onPress={() => setPayerId(item.user_id)}
                    >
                      <Text style={{ fontWeight: payerId === item.user_id ? '700' : '500', color: '#1F2937' }}>
                        {item.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Beneficiary selection */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>Pour qui ? (Partagé entre...)</Text>
                  <TouchableOpacity onPress={handleSelectAllBeneficiaries}>
                    <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '700' }}>
                      {selectedBeneficiaries.length === balances.length ? 'Tout décocher' : 'Tout cocher'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8, marginTop: 8 }}>
                  {balances.map((item) => {
                    const isSelected = selectedBeneficiaries.includes(item.user_id);
                    return (
                      <TouchableOpacity
                        key={item.user_id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: isSelected ? '#F0FDF4' : '#F9FAFB',
                          borderWidth: 1,
                          borderColor: isSelected ? '#22C55E' : '#E5E7EB',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onPress={() => handleToggleBeneficiary(item.user_id)}
                      >
                        <Text style={{ fontWeight: isSelected ? '700' : '500', color: '#1F2937' }}>
                          {item.username}
                        </Text>
                        <Text style={{ color: isSelected ? '#22C55E' : '#6B7280', fontWeight: '800' }}>
                          {isSelected ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.stopModalButtonsRow}>
              <TouchableOpacity
                style={styles.stopModalCancelButton}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.stopModalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stopModalConfirmButton, { backgroundColor: '#10B981' }]}
                onPress={handleAddExpense}
                disabled={saving}
              >
                <Text style={styles.stopModalConfirmButtonText}>
                  {saving ? 'Enregistrement...' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
