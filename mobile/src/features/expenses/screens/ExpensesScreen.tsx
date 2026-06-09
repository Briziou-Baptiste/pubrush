import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { fetchMyBarathonBalances, BarathonBalance } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ExpensesScreen() {
  const [balances, setBalances] = useState<BarathonBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      void loadBalances();
    }, [])
  );

  async function loadBalances() {
    try {
      setLoading(true);
      setErrorMsg('');
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const data = await fetchMyBarathonBalances(token);
      setBalances(data);
    } catch (err) {
      console.error('[Expenses] Error loading balances:', err);
      setErrorMsg('Impossible de charger vos dépenses.');
    } finally {
      setLoading(false);
    }
  }

  function handleCardPress(item: BarathonBalance) {
    router.push({
      pathname: '/barathon-stop-summary',
      params: {
        barathonId: String(item.barathon_id),
        barathonName: item.barathon_name,
      },
    });
  }

  function renderBalanceCard({ item }: { item: BarathonBalance }) {
    const isOwed = item.balance > 0;
    const formattedBalance = Math.abs(item.balance).toFixed(2);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.barathonName}>{item.barathon_name}</Text>
          <Text style={styles.description}>
            {isOwed ? (
              <Text style={styles.descriptionText}>
                On te doit <Text style={styles.owedText}>{formattedBalance} €</Text>
              </Text>
            ) : (
              <Text style={styles.descriptionText}>
                Tu dois <Text style={styles.oweText}>{formattedBalance} €</Text>
              </Text>
            )}
          </Text>
        </View>
        <Text style={styles.chevron}>❯</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Mes Dépenses</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : balances.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>Aucune dette ou créance en cours !</Text>
          </View>
        ) : (
          <FlatList
            data={balances}
            keyExtractor={(item) => String(item.barathon_id)}
            renderItem={renderBalanceCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EBF0F5',
  },
  cardContent: {
    flex: 1,
    paddingRight: 16,
  },
  barathonName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
  },
  descriptionText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  owedText: {
    color: '#10B981', // green-500
    fontWeight: '700',
  },
  oweText: {
    color: '#EF4444', // red-500
    fontWeight: '700',
  },
  chevron: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
});
