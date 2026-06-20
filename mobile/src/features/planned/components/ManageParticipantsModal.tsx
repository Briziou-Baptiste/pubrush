import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BarathonListItem } from '../../barathon_past_planned/types/barathon.types';
import { SearchUserResult } from '../../create_barathon/types/createBarathon.types';
import {
  searchUsers,
  getBarathonDetails,
  addParticipantsToBarathon,
  removeParticipantFromBarathon,
} from '../services/planned.service';

type ManageParticipantsModalProps = {
  visible: boolean;
  barathon: BarathonListItem | null;
  currentUserId: number;
  onClose: () => void;
  onUpdated: (updated: any) => void;
};

export default function ManageParticipantsModal({
  visible,
  barathon,
  currentUserId,
  onClose,
  onUpdated,
}: ManageParticipantsModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  const [fullBarathon, setFullBarathon] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [initialParticipantIds, setInitialParticipantIds] = useState<number[]>([]);

  const loadDetails = useCallback(async () => {
    if (!barathon) return;
    try {
      setLoadingDetails(true);
      const details = await getBarathonDetails(barathon.id);
      setFullBarathon(details);
      setParticipants(details.participants);
      setInitialParticipantIds(details.participants.map((p: any) => p.user.id));
    } catch (error) {
      Alert.alert(
        'Chargement impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
      onClose();
    } finally {
      setLoadingDetails(false);
    }
  }, [barathon, onClose]);

  const handleSearchUsers = useCallback(async (query: string) => {
    try {
      setLoadingSearch(true);
      const data = await searchUsers(query);

      const existingIds = participants.map((p: any) => p.user.id);
      const filtered = data.filter((candidate) => !existingIds.includes(candidate.id));

      setResults(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSearch(false);
    }
  }, [participants]);

  useEffect(() => {
    if (visible && barathon) {
      void loadDetails();
    } else {
      setFullBarathon(null);
      setParticipants([]);
      setInitialParticipantIds([]);
      setSearch('');
      setResults([]);
    }
  }, [visible, barathon, loadDetails]);

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
  }, [search, handleSearchUsers]);

  const addedParticipantIds = useMemo(() => {
    return participants
      .map((p) => p.user.id)
      .filter((id) => !initialParticipantIds.includes(id));
  }, [participants, initialParticipantIds]);

  function handleAddParticipant(user: SearchUserResult) {
    setParticipants((prev) => [
      ...prev,
      {
        id: Math.random(), // Dummy ID for list rendering key
        role: 'participant',
        user: user,
      },
    ]);
    setSearch('');
    setResults([]);
  }

  async function handleSaveNewParticipants() {
    if (!barathon || addedParticipantIds.length === 0) return;
    try {
      setActionUserId(-999); // Dummy ID for global saving loader
      const updated = await addParticipantsToBarathon(barathon.id, addedParticipantIds);
      setFullBarathon(updated);
      setParticipants(updated.participants);
      setInitialParticipantIds(updated.participants.map((p: any) => p.user.id));
      onUpdated(updated);
      Alert.alert('Succès', 'Les nouveaux participants ont été ajoutés.');
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : "Impossible d'ajouter les participants."
      );
    } finally {
      setActionUserId(null);
    }
  }

  function handleRemoveParticipantPress(userId: number, username: string) {
    if (!barathon) return;
    Alert.alert(
      'Retirer le participant',
      `Es-tu sûr de vouloir retirer ${username} de ce barathon ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => performRemoveParticipant(userId),
        },
      ]
    );
  }

  async function performRemoveParticipant(userId: number) {
    if (!barathon) return;
    try {
      setActionUserId(userId);
      const updated = await removeParticipantFromBarathon(barathon.id, userId);
      setFullBarathon(updated);
      setParticipants(updated.participants);
      setInitialParticipantIds(updated.participants.map((p: any) => p.user.id));
      onUpdated(updated);
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : "Impossible de retirer l'utilisateur."
      );
    } finally {
      setActionUserId(null);
    }
  }

  function handleRemovePendingParticipant(userId: number) {
    setParticipants((prev) => prev.filter((p) => p.user.id !== userId));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{"Gérer les participants"}</Text>
          {barathon && <Text style={styles.subtitle}>{barathon.name}</Text>}

          {loadingDetails ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher un utilisateur"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />

              {loadingSearch && (
                <View style={styles.loadingSearchContainer}>
                  <ActivityIndicator size="small" />
                </View>
              )}

              {results.length > 0 && (
                <View style={styles.resultsContainer}>
                  <Text style={styles.sectionHeader}>{"Résultats de recherche"}</Text>
                  <ScrollView style={styles.resultsScrollView} nestedScrollEnabled>
                    {results.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        onPress={() => handleAddParticipant(user)}
                        style={styles.searchResultCard}
                        disabled={actionUserId !== null}
                      >
                        <Text style={styles.searchResultUsername}>{user.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {results.length === 0 && search.trim().length > 0 && !loadingSearch && (
                <Text style={styles.emptyText}>{"Aucun utilisateur trouvé."}</Text>
              )}

              <Text style={styles.sectionHeader}>
                {`Participants (${participants.length})`}
              </Text>

              <ScrollView style={styles.participantsList} nestedScrollEnabled>
                {participants.map((participant: any) => {
                  const isCreator = fullBarathon?.created_by_user_id === participant.user.id;
                  const isCurrentUser = currentUserId === participant.user.id;
                  const isExisting = initialParticipantIds.includes(participant.user.id);
                  const isLoading = actionUserId === participant.user.id;

                  return (
                    <View key={participant.user.id} style={styles.participantCard}>
                      <View style={styles.participantHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.participantUsername}>
                            {participant.user.username} {isCurrentUser ? '(Toi)' : ''}
                          </Text>
                          {!isExisting && (
                            <Text style={styles.pendingBadge}>{"(Ajout en attente)"}</Text>
                          )}
                        </View>

                        {isLoading ? (
                          <ActivityIndicator size="small" />
                        ) : isCreator ? (
                          <Text style={styles.creatorBadge}>{"Créateur"}</Text>
                        ) : isExisting ? (
                          <TouchableOpacity
                            onPress={() =>
                              handleRemoveParticipantPress(
                                participant.user.id,
                                participant.user.username
                              )
                            }
                            disabled={actionUserId !== null}
                          >
                            <Text style={styles.removeText}>{"Supprimer"}</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleRemovePendingParticipant(participant.user.id)}
                            disabled={actionUserId !== null}
                          >
                            <Text style={styles.removePendingText}>{"Retirer"}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              addedParticipantIds.length === 0 || actionUserId !== null || loadingDetails
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleSaveNewParticipants}
            disabled={addedParticipantIds.length === 0 || actionUserId !== null || loadingDetails}
            activeOpacity={0.85}
          >
            {actionUserId === -999 ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{"Valider l'ajout"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={actionUserId !== null || loadingDetails}
            activeOpacity={0.85}
          >
            <Text style={styles.closeButtonText}>{"Fermer"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 14,
    marginBottom: 12,
  },
  loadingSearchContainer: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  resultsContainer: {
    maxHeight: 180,
    marginBottom: 16,
  },
  resultsScrollView: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  searchResultCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 10,
  },
  participantsList: {
    flexGrow: 0,
    maxHeight: 220,
    marginBottom: 16,
  },
  participantCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  pendingBadge: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    fontWeight: '500',
  },
  creatorBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  removePendingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    marginTop: 8,
    flexDirection: 'row',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  closeButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
