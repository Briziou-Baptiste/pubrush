import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { navigationControlStyles } from '../../../lib/navigation.styles';
import {
  PhotoChallengeItem,
  PhotoMysteryState,
} from '../types/photoMystery.types';
import {
  cancelPhotoChallenge,
  createPhotoChallengeDraft,
  fetchPhotoMysteryState,
  getAuthHeadersForPhoto,
  getPhotoMediaUrl,
  publishPhotoChallenge,
  submitPhotoAnswer,
} from '../services/photoMysteryService';

type Props = {
  visible: boolean;
  onClose: () => void;
  barathonId: number;
  initialState?: PhotoMysteryState | null;
  onStateUpdated?: (newState: PhotoMysteryState) => void;
};

export default function PhotoMysteryModal({
  visible,
  onClose,
  barathonId,
  initialState,
  onStateUpdated,
}: Props) {
  const [state, setState] = useState<PhotoMysteryState | null>(initialState || null);
  const [loading, setLoading] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});

  // Mode: "VIEW" | "CREATE"
  const [mode, setMode] = useState<'VIEW' | 'CREATE'>('VIEW');

  // Form states for creation
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [createdDraft, setCreatedDraft] = useState<{
    id: string;
    upload_code: string;
  } | null>(null);

  // Submitting states
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadState();
      getAuthHeadersForPhoto().then(setAuthHeaders);
    }
  }, [visible, barathonId]);

  async function loadState() {
    try {
      setLoading(true);
      const s = await fetchPhotoMysteryState(barathonId);
      setState(s);
      onStateUpdated?.(s);
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  }

  // Active challenge to display
  const activeChallenge: PhotoChallengeItem | undefined =
    state?.items.find((i) => i.state === 'published') ||
    state?.items.find((i) => i.state === 'draft') ||
    state?.items[0];

  async function handleAnswer(choiceIndex: number | null, passed: boolean) {
    if (!activeChallenge) return;
    try {
      setSubmittingAnswer(true);
      await submitPhotoAnswer(barathonId, activeChallenge.id, {
        choice_index: choiceIndex,
        passed,
      });
      await loadState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de soumettre la réponse.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function handleCreateDraft() {
    const trimmedQ = question.trim();
    if (trimmedQ.length < 3 || trimmedQ.length > 180) {
      Alert.alert('Question invalide', 'La question doit comporter entre 3 et 180 caractères.');
      return;
    }

    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean);
    if (trimmedOpts.length < 2) {
      Alert.alert('Options requises', 'Veuillez renseigner au moins 2 options différentes.');
      return;
    }

    try {
      setLoading(true);
      const draft = await createPhotoChallengeDraft(barathonId, {
        question: trimmedQ,
        options: trimmedOpts,
        correct_index: correctIndex,
      });
      setCreatedDraft({
        id: draft.id,
        upload_code: draft.upload_code,
      });
      await loadState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de création du défi.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenWebCamera() {
    const baseUrl =
      process.env.EXPO_PUBLIC_WEB_URL ||
      'https://pubrush.com/photo-capture';
    const webUrl = createdDraft?.upload_code
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}code=${encodeURIComponent(createdDraft.upload_code)}`
      : baseUrl;
    try {
      await WebBrowser.openBrowserAsync(webUrl);
      // Reload state when user returns from browser
      await loadState();
    } catch {
      Alert.alert('Navigateur', 'Impossible d’ouvrir la page de capture.');
    }
  }

  async function handlePublish(challengeId: string) {
    try {
      setPublishing(true);
      await publishPhotoChallenge(barathonId, challengeId);
      setCreatedDraft(null);
      setMode('VIEW');
      await loadState();
      Alert.alert('Défi publié !', 'Vos amis ont 3 minutes pour deviner.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de publier le défi.';
      Alert.alert('Erreur', msg);
    } finally {
      setPublishing(false);
    }
  }

  async function handleCancel(challengeId: string) {
    try {
      await cancelPhotoChallenge(barathonId, challengeId);
      setCreatedDraft(null);
      setMode('VIEW');
      await loadState();
    } catch {
      // Ignored
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="camera-outline" size={22} color="#0EA5E9" />
              <Text style={styles.title}>Photo Mystère</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              style={[styles.closeButton, navigationControlStyles.close]}
            >
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && !state && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
              </View>
            )}

            {/* Mode VIEW: Display challenge or empty state */}
            {mode === 'VIEW' && (
              <>
                {activeChallenge ? (
                  <View style={styles.challengeCard}>
                    {/* Badge d'état */}
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.badge,
                          activeChallenge.state === 'published'
                            ? styles.badgePublished
                            : activeChallenge.state === 'closed'
                            ? styles.badgeClosed
                            : styles.badgeDraft,
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {activeChallenge.state === 'published'
                            ? 'Défi en cours (3 min)'
                            : activeChallenge.state === 'closed'
                            ? 'Défi terminé'
                            : 'Brouillon'}
                        </Text>
                      </View>

                      {activeChallenge.can_answer && (
                        <View style={styles.mustAnswerBadge}>
                          <Text style={styles.mustAnswerText}>À ton tour !</Text>
                        </View>
                      )}
                    </View>

                    {/* Photo */}
                    {activeChallenge.photo_available ? (
                      <View style={styles.photoContainer}>
                        <Image
                          source={{
                            uri: getPhotoMediaUrl(barathonId, activeChallenge.id),
                            headers: authHeaders,
                          }}
                          cachePolicy="none"
                          style={styles.photo}
                          contentFit="cover"
                        />
                      </View>
                    ) : (
                      <View style={styles.noPhotoPlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#6B7280" />
                        <Text style={styles.noPhotoText}>Photo en attente de capture</Text>
                      </View>
                    )}

                    {/* Question */}
                    <Text style={styles.questionText}>{activeChallenge.question}</Text>

                    {/* Options / Réponse */}
                    {activeChallenge.state === 'published' && activeChallenge.can_answer && (
                      <View style={styles.optionsContainer}>
                        {activeChallenge.options?.map((opt, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.optionButton}
                            activeOpacity={0.8}
                            disabled={submittingAnswer}
                            onPress={() => handleAnswer(idx, false)}
                          >
                            <Text style={styles.optionButtonText}>{opt}</Text>
                          </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                          style={styles.passButton}
                          activeOpacity={0.8}
                          disabled={submittingAnswer}
                          onPress={() => handleAnswer(null, true)}
                        >
                          <Text style={styles.passButtonText}>Passer mon tour</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Déjà répondu mais pas encore clos */}
                    {activeChallenge.state === 'published' && !activeChallenge.can_answer && (
                      <View style={styles.waitingResultBox}>
                        <Ionicons name="hourglass-outline" size={20} color="#0EA5E9" />
                        <Text style={styles.waitingResultText}>
                          {activeChallenge.my_submission
                            ? 'Ta réponse est enregistrée ! En attente des autres joueurs...'
                            : 'Tu es l’auteur de ce défi. En attente des réponses de tes amis...'}
                        </Text>
                      </View>
                    )}

                    {/* Résultats clos */}
                    {activeChallenge.state === 'closed' && activeChallenge.results && (
                      <View style={styles.resultsBox}>
                        <Text style={styles.resultsTitle}>Résultats du défi</Text>
                        <Text style={styles.correctAnswerText}>
                          Bonne réponse :{' '}
                          <Text style={{ fontWeight: '800', color: '#10B981' }}>
                            {activeChallenge.options?.[activeChallenge.correct_index ?? 0] || 'Inconnue'}
                          </Text>
                        </Text>

                        <View style={styles.scoreRow}>
                          <Text style={styles.scoreText}>
                            ✅ {activeChallenge.results.correct_count} correct(s)
                          </Text>
                          <Text style={styles.scoreText}>
                            ❌ {activeChallenge.results.incorrect_count} faux
                          </Text>
                          <Text style={styles.scoreText}>
                            ⏭️ {activeChallenge.results.passed_count} passé(s)
                          </Text>
                        </View>

                        {/* Gage */}
                        {activeChallenge.results.my_dare_assigned && (
                          <View style={styles.dareBox}>
                            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                            <Text style={styles.dareText}>
                              Gage facultatif pour toi : Choisis le thème du prochain bar ou mime un objet !
                            </Text>
                          </View>
                        )}
                        {activeChallenge.results.creator_dare && (
                          <View style={styles.dareBox}>
                            <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
                            <Text style={styles.dareText}>
                              100% de bonnes réponses ! Gage pour l’auteur : offre une tournée ou choisis le prochain bar !
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Brouillon en attente de publication */}
                    {activeChallenge.state === 'draft' && (
                      <View style={styles.draftBox}>
                        {activeChallenge.photo_available ? (
                          <TouchableOpacity
                            style={styles.publishButton}
                            disabled={publishing}
                            onPress={() => handlePublish(activeChallenge.id)}
                          >
                            {publishing ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="send" size={16} color="#FFFFFF" />
                                <Text style={styles.publishButtonText}>Publier le défi</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleOpenWebCamera}
                          >
                            <Ionicons name="camera" size={16} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Prendre la photo</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={{ marginTop: 8 }}
                          onPress={() => handleCancel(activeChallenge.id)}
                        >
                          <Text style={{ color: '#EF4444', textAlign: 'center', fontSize: 13 }}>
                            Abandonner ce brouillon
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="camera-reverse-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>Aucun défi en cours</Text>
                    <Text style={styles.emptySubtitle}>
                      Prends en photo un détail insolite dans le bar et mets tes amis au défi de deviner !
                    </Text>
                  </View>
                )}

                {/* Bouton Créer un défi */}
                {state?.can_create && !createdDraft && activeChallenge?.state !== 'draft' && (
                  <TouchableOpacity
                    style={styles.createChallengeButton}
                    activeOpacity={0.85}
                    onPress={() => setMode('CREATE')}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.createChallengeText}>Créer un nouveau défi</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Mode CREATE: Create Challenge Form */}
            {mode === 'CREATE' && (
              <View style={styles.createForm}>
                <Text style={styles.sectionTitle}>1. Pose ta question</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex : De quelle couleur est le dessous de verre ?"
                  placeholderTextColor="#9CA3AF"
                  value={question}
                  onChangeText={setQuestion}
                  maxLength={180}
                />

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  2. Propositions (choisis la bonne réponse)
                </Text>
                {options.map((opt, idx) => (
                  <View key={idx} style={styles.optionInputRow}>
                    <TouchableOpacity
                      style={[
                        styles.radioCircle,
                        correctIndex === idx && styles.radioCircleSelected,
                      ]}
                      onPress={() => setCorrectIndex(idx)}
                    >
                      {correctIndex === idx && <View style={styles.radioDot} />}
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor="#9CA3AF"
                      value={opt}
                      onChangeText={(t) => {
                        const newOpts = [...options];
                        newOpts[idx] = t;
                        setOptions(newOpts);
                      }}
                      maxLength={60}
                    />
                  </View>
                ))}

                {options.length < 4 && (
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={() => setOptions([...options, ''])}
                  >
                    <Ionicons name="add" size={16} color="#0EA5E9" />
                    <Text style={styles.addOptionText}>Ajouter une option</Text>
                  </TouchableOpacity>
                )}

                {/* Code de capture & Caméra */}
                {createdDraft ? (
                  <View style={styles.draftReadyBox}>
                    <Text style={styles.codeLabel}>Ton code de capture (valable 2 min) :</Text>
                    <Text style={styles.codeValue}>{createdDraft.upload_code}</Text>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleOpenWebCamera}
                    >
                      <Ionicons name="camera" size={16} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Ouvrir la caméra sécurisée</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, { marginTop: 24 }]}
                    disabled={loading}
                    onPress={handleCreateDraft}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="key-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Générer le code de capture</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.cancelFormButton}
                  onPress={() => {
                    setMode('VIEW');
                    setCreatedDraft(null);
                  }}
                >
                  <Text style={styles.cancelFormText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
  },
  challengeCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePublished: {
    backgroundColor: '#0EA5E9',
  },
  badgeClosed: {
    backgroundColor: '#10B981',
  },
  badgeDraft: {
    backgroundColor: '#6B7280',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mustAnswerBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mustAnswerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  photoContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  noPhotoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noPhotoText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 6,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionButtonText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
  passButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  passButtonText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  waitingResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C720',
    padding: 12,
    borderRadius: 12,
  },
  waitingResultText: {
    color: '#E0F2FE',
    fontSize: 13,
    flex: 1,
  },
  resultsBox: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 6,
  },
  correctAnswerText: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  scoreText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  dareBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#7F1D1D40',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    alignItems: 'center',
  },
  dareText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  draftBox: {
    marginTop: 8,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  createChallengeButton: {
    backgroundColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createChallengeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  createForm: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
    fontSize: 14,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#10B981',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  addOptionText: {
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: '600',
  },
  draftReadyBox: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  codeLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  codeValue: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  actionButton: {
    backgroundColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  publishButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelFormButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelFormText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});
