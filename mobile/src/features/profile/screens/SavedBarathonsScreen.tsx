import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { fetchMySavedBarathons, deleteSavedBarathon, SavedBarathon } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function SavedBarathonsScreen() {
  const [savedBarathons, setSavedBarathons] = useState<SavedBarathon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      void loadSavedBarathons();
    }, [])
  );

  async function loadSavedBarathons() {
    try {
      setLoading(true);
      setErrorMsg('');
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const data = await fetchMySavedBarathons(token);
      setSavedBarathons(data);
    } catch (err) {
      console.error('[SavedBarathons] Error loading saved barathons:', err);
      setErrorMsg('Impossible de charger vos barathons enregistrés.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePress(item: SavedBarathon) {
    Alert.alert(
      'Supprimer',
      `Voulez-vous vraiment supprimer "${item.name}" de vos barathons enregistrés ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAccessToken();
              if (!token) return;
              await deleteSavedBarathon(item.id, token);
              // Refresh local state
              setSavedBarathons(prev => prev.filter(b => b.id !== item.id));
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer ce barathon.');
            }
          },
        },
      ]
    );
  }

  function renderSavedBarathonCard({ item }: { item: SavedBarathon }) {
    const stopsList = item.stops.map(s => s.name).join(' ➔ ');

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.barathonName}>{item.name}</Text>
            <Text style={styles.metadataText}>
              ⏱️ {item.max_time_in_bar_minutes}m par bar • 🚶‍♂️ {item.travel_time_between_bars_minutes}m trajet
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeletePress(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stopsContainer}>
          <Text style={styles.stopsLabel}>Parcours ({item.stops.length} étapes) :</Text>
          {item.stops.length === 0 ? (
            <Text style={styles.emptyStopsText}>Aucun bar enregistré</Text>
          ) : (
            <Text style={styles.stopsFlow} numberOfLines={2}>
              {stopsList}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Barathons Enregistrés</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : savedBarathons.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyIcon}>💾</Text>
            <Text style={styles.emptyText}>Vous n'avez pas encore de barathon enregistré.</Text>
            <Text style={styles.emptySubtext}>
              Pour enregistrer un barathon, rendez-vous dans l'historique de vos barathons passés et cliquez sur l'un d'eux.
            </Text>
          </View>
        ) : (
          <FlatList
            data={savedBarathons}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderSavedBarathonCard}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
  },
  listContainer: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EBF0F5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  barathonName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  metadataText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteIcon: {
    fontSize: 16,
  },
  stopsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  stopsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  emptyStopsText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  stopsFlow: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    lineHeight: 18,
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
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
});
