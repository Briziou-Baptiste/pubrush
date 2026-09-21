import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fetchBarsSearch, fetchNearbyBars } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';
import { addBarathonStop, replaceBarathonStop } from '../services/activeBarathon.service';
import { ActiveBarathonData, ActiveBarathonStop, LatLng } from '../types/activeBarathon.types';

type Props = {
  visible: boolean;
  mode: 'replace' | 'add';
  currentStop: ActiveBarathonStop | null;
  barathonId: number;
  userLocation: LatLng | null;
  onClose: () => void;
  onSuccess: (updatedBarathon: ActiveBarathonData) => void;
};

type BarCandidate = {
  name: string;
  latitude: number;
  longitude: number;
  stop_type?: string;
  street?: string | null;
  city?: string | null;
  estimated_minutes?: number | null;
};

export default function ReplaceOrAddStopModal({
  visible,
  mode,
  currentStop,
  barathonId,
  userLocation,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState<'fermé' | 'bondé' | 'autre'>('fermé');
  const [customReason, setCustomReason] = useState('');
  const [position, setPosition] = useState<'before_current' | 'after_current' | 'at_end'>('after_current');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingBars, setLoadingBars] = useState(false);
  const [bars, setBars] = useState<BarCandidate[]>([]);
  const [selectedBar, setSelectedBar] = useState<BarCandidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reference coordinates for search/nearby (current stop or user location)
  const centerLat = currentStop ? Number(currentStop.latitude) : userLocation?.latitude ?? 43.6047;
  const centerLon = currentStop ? Number(currentStop.longitude) : userLocation?.longitude ?? 1.4442;

  // Load nearby bars around the reference coordinates
  const loadNearbySuggestions = useCallback(async () => {
    try {
      setLoadingBars(true);
      const token = await getAccessToken();
      if (!token) return;

      const data = await fetchNearbyBars(centerLat, centerLon, 15, token);
      if (Array.isArray(data)) {
        const formatted: BarCandidate[] = data.map((b: any) => ({
          name: b.name,
          latitude: Number(b.latitude || b.lat),
          longitude: Number(b.longitude || b.lon),
          stop_type: b.stop_type || 'bar',
          street: b.street || null,
          city: b.city || null,
          estimated_minutes: b.estimated_minutes,
        }));
        setBars(formatted);
      }
    } catch (err) {
      console.error('Error loading nearby bars for modal:', err);
    } finally {
      setLoadingBars(false);
    }
  }, [centerLat, centerLon]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedBar(null);
      setSearchQuery('');
      setReason('fermé');
      setCustomReason('');
      setPosition('after_current');
      void loadNearbySuggestions();
    }
  }, [visible, mode, currentStop?.id, loadNearbySuggestions]);

  // Search when user changes text
  useEffect(() => {
    if (!visible || !searchQuery.trim()) {
      if (visible && searchQuery.trim() === '') {
        void loadNearbySuggestions();
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingBars(true);
        const token = await getAccessToken();
        if (!token) return;

        const data = await fetchBarsSearch(searchQuery.trim(), centerLat, centerLon, token);
        if (Array.isArray(data)) {
          const formatted: BarCandidate[] = data.map((b: any) => ({
            name: b.name,
            latitude: Number(b.latitude || b.lat),
            longitude: Number(b.longitude || b.lon),
            stop_type: b.stop_type || 'bar',
            street: b.street || null,
            city: b.city || null,
            estimated_minutes: b.estimated_minutes,
          }));
          setBars(formatted);
        }
      } catch (err) {
        console.error('Error searching bars for modal:', err);
      } finally {
        setLoadingBars(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, visible, centerLat, centerLon, loadNearbySuggestions]);

  // Handle submit action
  async function handleSubmit() {
    if (!selectedBar) {
      Alert.alert('Sélection requise', 'Veuillez sélectionner un bar dans la liste.');
      return;
    }

    try {
      setSubmitting(true);

      if (mode === 'replace') {
        if (!currentStop) {
          Alert.alert('Erreur', "Aucune étape actuelle à remplacer n'a été trouvée.");
          return;
        }

        const finalReason = reason === 'autre' ? (customReason.trim() || 'Autre') : reason;
        const updated = await replaceBarathonStop(barathonId, currentStop.id, {
          name: selectedBar.name,
          latitude: selectedBar.latitude,
          longitude: selectedBar.longitude,
          stop_type: selectedBar.stop_type || 'bar',
          reason: finalReason,
        });

        Alert.alert('Étape remplacée', `L'étape "${currentStop.name}" a bien été remplacée par "${selectedBar.name}".`);
        onSuccess(updated);
        onClose();
      } else {
        // Add mode
        const updated = await addBarathonStop(barathonId, {
          name: selectedBar.name,
          latitude: selectedBar.latitude,
          longitude: selectedBar.longitude,
          stop_type: selectedBar.stop_type || 'bar',
          position,
          current_stop_id: currentStop?.id,
        });

        Alert.alert('Étape ajoutée', `"${selectedBar.name}" a été ajouté au parcours !`);
        onSuccess(updated);
        onClose();
      }
    } catch (err) {
      Alert.alert(
        'Erreur',
        err instanceof Error ? err.message : "Une erreur est survenue lors de l'opération."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {mode === 'replace' ? "🔄 Remplacer l'étape" : '➕ Ajouter un bar'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'replace'
                  ? `Remplacement de : ${currentStop?.name ?? 'Étape courante'}`
                  : 'Insère une nouvelle étape dans le barathon'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Section: Mode-specific options */}
          {mode === 'replace' ? (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Motif du remplacement :</Text>
              <View style={styles.pillsRow}>
                <TouchableOpacity
                  style={[styles.pill, reason === 'fermé' && styles.pillActive]}
                  onPress={() => setReason('fermé')}
                >
                  <Text style={[styles.pillText, reason === 'fermé' && styles.pillTextActive]}>
                    🚫 Bar fermé
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pill, reason === 'bondé' && styles.pillActive]}
                  onPress={() => setReason('bondé')}
                >
                  <Text style={[styles.pillText, reason === 'bondé' && styles.pillTextActive]}>
                    👥 Bar bondé
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pill, reason === 'autre' && styles.pillActive]}
                  onPress={() => setReason('autre')}
                >
                  <Text style={[styles.pillText, reason === 'autre' && styles.pillTextActive]}>
                    ✍️ Autre
                  </Text>
                </TouchableOpacity>
              </View>

              {reason === 'autre' && (
                <TextInput
                  style={styles.customReasonInput}
                  placeholder="Préciser la raison..."
                  placeholderTextColor="#9CA3AF"
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              )}
            </View>
          ) : (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Position dans le parcours :</Text>
              <View style={styles.pillsRow}>
                <TouchableOpacity
                  style={[styles.pill, position === 'before_current' && styles.pillActive]}
                  onPress={() => setPosition('before_current')}
                >
                  <Text style={[styles.pillText, position === 'before_current' && styles.pillTextActive]}>
                    ⏪ Avant l’étape
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pill, position === 'after_current' && styles.pillActive]}
                  onPress={() => setPosition('after_current')}
                >
                  <Text style={[styles.pillText, position === 'after_current' && styles.pillTextActive]}>
                    ⏩ Après l’étape
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pill, position === 'at_end' && styles.pillActive]}
                  onPress={() => setPosition('at_end')}
                >
                  <Text style={[styles.pillText, position === 'at_end' && styles.pillTextActive]}>
                    🏁 À la fin
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Search Bar Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un bar par nom..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Selected Bar Preview */}
          {selectedBar && (
            <View style={styles.selectedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.selectedBannerTitle} numberOfLines={1}>
                  {selectedBar.name}
                </Text>
                <Text style={styles.selectedBannerSubtitle}>Sélectionné pour l’étape</Text>
              </View>
            </View>
          )}

          {/* List of Bars */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderLabel}>
              {searchQuery.trim() ? 'Résultats de recherche' : 'Bars suggérés à proximité'}
            </Text>
            {loadingBars && <ActivityIndicator size="small" color="#2563EB" />}
          </View>

          <ScrollView style={styles.barsList} keyboardShouldPersistTaps="handled">
            {bars.length === 0 && !loadingBars ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>Aucun lieu trouvé à proximité.</Text>
              </View>
            ) : (
              bars.map((item, index) => {
                const isSelected = selectedBar?.name === item.name && selectedBar?.latitude === item.latitude;
                return (
                  <TouchableOpacity
                    key={`${item.name}-${index}`}
                    style={[styles.barItem, isSelected && styles.barItemSelected]}
                    onPress={() => setSelectedBar(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.barItemIcon}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? '#2563EB' : '#9CA3AF'}
                      />
                    </View>
                    <View style={styles.barItemContent}>
                      <Text style={[styles.barItemName, isSelected && styles.barItemNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.barItemAddress} numberOfLines={1}>
                        {item.street ? `${item.street}${item.city ? ', ' + item.city : ''}` : 'Bar à proximité'}
                      </Text>
                    </View>
                    {item.estimated_minutes !== undefined && item.estimated_minutes !== null && (
                      <View style={styles.barItemBadge}>
                        <Text style={styles.barItemBadgeText}>~{item.estimated_minutes} min</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedBar || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedBar || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'replace' ? 'Confirmer le remplacement' : "Valider l'ajout"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  pillTextActive: {
    color: '#2563EB',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
    paddingVertical: 2,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  selectedBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  selectedBannerSubtitle: {
    fontSize: 11,
    color: '#166534',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  listHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barsList: {
    maxHeight: 200,
    marginBottom: 14,
  },
  emptyList: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  barItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  barItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  barItemIcon: {
    marginRight: 10,
  },
  barItemContent: {
    flex: 1,
  },
  barItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  barItemNameSelected: {
    color: '#1D4ED8',
  },
  barItemAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  barItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  barItemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
