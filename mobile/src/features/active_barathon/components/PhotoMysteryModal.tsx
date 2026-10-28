import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import * as Clipboard from 'expo-clipboard';

import { navigationControlStyles } from '../../../lib/navigation.styles';
import {
  PhotoChallengeItem,
  PhotoMysteryState,
  PhotoMysterySnapshot,
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
import { preparePhotoChallengePayload } from '../utils/photoMysteryPayload';
import {
  ReconcileResult,
  reconcilePhotoMysteryState,
  reconcileSingleItemIntoState,
} from '../utils/photoMysteryState';
import { subscribePhotoMysteryEvents } from '../services/photoMysteryEvents';

type Props = {
  visible: boolean;
  onClose: () => void;
  barathonId: number;
  initialSnapshot?: PhotoMysterySnapshot | null;
  onStateUpdated?: (snapshot: PhotoMysterySnapshot) => void;
};

type PhotoSession = {
  barathonId: number;
  active: boolean;
  latestRequestId: number;
};

// A different room gets a fresh component, including forms and upload capabilities.
export default function PhotoMysteryModal(props: Props) {
  return <PhotoMysteryModalSession key={props.barathonId} {...props} />;
}

function PhotoMysteryModalSession({
  visible,
  onClose,
  barathonId,
  initialSnapshot,
  onStateUpdated,
}: Props) {
  const initial = initialSnapshot?.barathonId === barathonId ? initialSnapshot : null;
  const [snapshot, setSnapshot] = useState<PhotoMysterySnapshot | null>(initial);
  const snapshotRef = useRef(initial);
  const state = snapshot?.barathonId === barathonId ? snapshot.state : null;
  const [loading, setLoading] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'VIEW' | 'CREATE'>('VIEW');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [createdDraft, setCreatedDraft] = useState<{ id: string; upload_code: string } | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const sessionRef = useRef<PhotoSession | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function isCurrent(session: PhotoSession): boolean {
    return session.active && sessionRef.current === session;
  }

  function currentSession(): PhotoSession | null {
    const session = sessionRef.current;
    return session && isCurrent(session) && session.barathonId === barathonId ? session : null;
  }

  // One lifetime owns requests, browser callbacks and subscriptions. Closing,
  // unmounting or changing room invalidates every continuation from that lifetime.
  useEffect(() => {
    const session: PhotoSession = { barathonId, active: visible, latestRequestId: 0 };
    sessionRef.current = session;
    setLoading(false);
    setSubmittingAnswer(false);
    setPublishing(false);
    setCopiedCode(false);
    if (visible) {
      void loadState(session);
      void getAuthHeadersForPhoto().then(headers => {
        if (isCurrent(session)) setAuthHeaders(headers);
      }).catch(() => {});
    }
    const unsubscribe = visible ? subscribePhotoMysteryEvents(evt => {
      if (evt.barathon_id === session.barathonId) void loadState(session);
    }) : undefined;
    const appState = visible ? AppState.addEventListener('change', next => {
      if (next === 'active') void loadState(session);
    }) : undefined;
    return () => {
      session.active = false;
      unsubscribe?.();
      appState?.remove();
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = null;
    };
  }, [barathonId, visible]);

  function commit(session: PhotoSession, result: ReconcileResult, notify: boolean) {
    if (!isCurrent(session) || !result.shouldUpdate) return;
    const next = { barathonId: session.barathonId, state: result.nextState };
    snapshotRef.current = next;
    setSnapshot(next);
    // Notify outside a React state updater: no render-phase parent update or replay.
    if (notify) onStateUpdated?.(next);
  }

  function acceptSnapshot(session: PhotoSession, incoming: PhotoMysteryState, notify = true) {
    if (!isCurrent(session)) return;
    commit(session, reconcilePhotoMysteryState(
      snapshotRef.current?.state || null, incoming, session.barathonId, session.barathonId
    ), notify);
  }

  useEffect(() => {
    const session = currentSession();
    if (session && initialSnapshot?.barathonId === session.barathonId) {
      acceptSnapshot(session, initialSnapshot.state, false);
    }
  }, [initialSnapshot, barathonId, visible]);

  async function loadState(session: PhotoSession) {
    // Reject before changing the request sequence or any loading state.
    if (!isCurrent(session)) return;
    const reqId = ++session.latestRequestId;
    setLoading(true);
    try {
      const incoming = await fetchPhotoMysteryState(session.barathonId);
      if (!isCurrent(session) || reqId !== session.latestRequestId) return;
      acceptSnapshot(session, incoming);
      const draftWithPhoto = snapshotRef.current?.state.items.find(
        item => item.state === 'draft' && item.photo_available
      );
      if (draftWithPhoto) {
        setMode('VIEW');
        setCreatedDraft(null);
      }
    } catch {
      // Keep the last authenticated snapshot; the next event/foreground retries.
    } finally {
      if (isCurrent(session) && reqId === session.latestRequestId) setLoading(false);
    }
  }

  const activeChallenge: PhotoChallengeItem | undefined =
    state?.items.find(item => item.state === 'published') ||
    state?.items.find(item => item.state === 'draft') ||
    state?.items[0];

  async function handleAnswer(choiceIndex: number | null, passed: boolean) {
    if (!activeChallenge || submittingAnswer) return;
    if (activeChallenge.my_submission !== null || !activeChallenge.can_answer) return;
    const session = currentSession();
    if (!session) return;
    try {
      setSubmittingAnswer(true);
      const updatedItem = await submitPhotoAnswer(session.barathonId, activeChallenge.id, {
        choice_index: choiceIndex, passed,
      });
      if (!isCurrent(session)) return;
      commit(session, reconcileSingleItemIntoState(
        snapshotRef.current?.state || null, updatedItem, session.barathonId, session.barathonId
      ), true);
      await loadState(session);
    } catch (err: unknown) {
      if (!isCurrent(session)) return;
      await loadState(session);
      if (!isCurrent(session)) return;
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de soumettre la réponse.');
    } finally {
      if (isCurrent(session)) setSubmittingAnswer(false);
    }
  }

  async function handleCreateDraft() {
    const session = currentSession();
    if (!session || loading) return;
    const validation = preparePhotoChallengePayload({ question, options, correctIndex });
    if (!validation.success) {
      Alert.alert('Formulaire incomplet', validation.error);
      return;
    }
    const existingDraft = state?.items.find(item => item.state === 'draft');
    if (existingDraft && !existingDraft.photo_available) {
      setCreatedDraft({ id: existingDraft.id, upload_code: '' });
      setMode('VIEW');
      return;
    }
    try {
      setLoading(true);
      const draft = await createPhotoChallengeDraft(session.barathonId, validation.payload);
      if (!isCurrent(session)) return;
      setCreatedDraft({ id: draft.id, upload_code: draft.upload_code });
      await loadState(session);
    } catch (err: unknown) {
      if (!isCurrent(session)) return;
      await loadState(session);
      if (!isCurrent(session)) return;
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Erreur de création du défi.');
    } finally {
      if (isCurrent(session)) setLoading(false);
    }
  }

  async function handleRegenerateCode() {
    const session = currentSession();
    if (!session || loading) return;
    const validation = preparePhotoChallengePayload({ question, options, correctIndex });
    if (!validation.success) {
      Alert.alert('Formulaire incomplet', validation.error);
      return;
    }
    try {
      setLoading(true);
      const draftId = createdDraft?.id || state?.items.find(item => item.state === 'draft')?.id;
      if (draftId) {
        try {
          await cancelPhotoChallenge(session.barathonId, draftId);
        } catch {}
      }
      const draft = await createPhotoChallengeDraft(session.barathonId, validation.payload);
      if (!isCurrent(session)) return;
      setCreatedDraft({ id: draft.id, upload_code: draft.upload_code });
      setCopiedCode(false);
      try {
        await Clipboard.setStringAsync(draft.upload_code);
        setCopiedCode(true);
      } catch {}
      await loadState(session);
      Alert.alert('Nouveau code', 'Un nouveau code de capture a été généré.');
    } catch (err: unknown) {
      if (!isCurrent(session)) return;
      await loadState(session);
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de régénérer le code.');
    } finally {
      if (isCurrent(session)) setLoading(false);
    }
  }

  async function handleCopyCode(code: string) {
    const session = currentSession();
    if (!session) return;
    try {
      const ok = await Clipboard.setStringAsync(code);
      if (isCurrent(session) && ok !== false) {
        setCopiedCode(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => {
          if (isCurrent(session)) setCopiedCode(false);
        }, 2500);
      }
    } catch {}
  }

  async function handleOpenWebCamera() {
    const session = currentSession();
    if (!session) return;
    if (createdDraft?.upload_code) {
      try {
        const ok = await Clipboard.setStringAsync(createdDraft.upload_code);
        if (!isCurrent(session)) return;
        if (ok !== false) setCopiedCode(true);
      } catch {}
    }
    if (!isCurrent(session)) return;
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://pubrush.com/photo-capture';
    try {
      await WebBrowser.openBrowserAsync(webUrl);
      await loadState(session);
    } catch {
      if (isCurrent(session)) Alert.alert('Navigateur', 'Impossible d’ouvrir la page de capture.');
    }
  }

  async function handlePublish(challengeId: string) {
    if (publishing) return;
    const session = currentSession();
    if (!session) return;
    try {
      setPublishing(true);
      const current = state?.items.find(item => item.id === challengeId);
      if (current && current.state !== 'draft') {
        await loadState(session);
        return;
      }
      await publishPhotoChallenge(session.barathonId, challengeId);
      if (!isCurrent(session)) return;
      setCreatedDraft(null);
      setMode('VIEW');
      await loadState(session);
      if (isCurrent(session)) Alert.alert('Défi publié !', 'Vos amis ont 3 minutes pour deviner.');
    } catch (err: unknown) {
      if (!isCurrent(session)) return;
      await loadState(session);
      if (!isCurrent(session)) return;
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de publier le défi.');
    } finally {
      if (isCurrent(session)) setPublishing(false);
    }
  }

  async function handleCancel(challengeId: string) {
    const session = currentSession();
    if (!session) return;
    try {
      setLoading(true);
      await cancelPhotoChallenge(session.barathonId, challengeId);
      if (!isCurrent(session)) return;
      setCreatedDraft(null);
      setMode('VIEW');
      await loadState(session);
    } catch {
      await loadState(session);
    } finally {
      if (isCurrent(session)) setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
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
                              : activeChallenge.state === 'expired'
                              ? styles.badgeExpired
                              : activeChallenge.state === 'cancelled'
                              ? styles.badgeCancelled
                              : styles.badgeDraft,
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {activeChallenge.state === 'published'
                              ? 'Défi en cours (3 min)'
                              : activeChallenge.state === 'closed'
                              ? 'Défi terminé'
                              : activeChallenge.state === 'expired'
                              ? 'Défi expiré'
                              : activeChallenge.state === 'cancelled'
                              ? 'Défi annulé'
                              : 'Brouillon'}
                          </Text>
                        </View>

                        {activeChallenge.can_answer && (
                          <View style={styles.mustAnswerBadge}>
                            <Text style={styles.mustAnswerText}>À ton tour !</Text>
                          </View>
                        )}
                      </View>

                      {/* Photo - affichage intégral sans rogner (portrait ou paysage) */}
                      {activeChallenge.photo_available ? (
                        <View style={styles.photoContainer}>
                          <Image
                            source={{
                              uri: getPhotoMediaUrl(barathonId, activeChallenge.id),
                              headers: authHeaders,
                            }}
                            cachePolicy="none"
                            style={styles.photo}
                            contentFit="contain"
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
                            <View style={styles.scoreBadgeItem}>
                              <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                              <Text style={styles.scoreText}>
                                {activeChallenge.results.correct_count} correct(s)
                              </Text>
                            </View>
                            <View style={styles.scoreBadgeItem}>
                              <Ionicons name="close-circle" size={15} color="#EF4444" />
                              <Text style={styles.scoreText}>
                                {activeChallenge.results.incorrect_count} faux
                              </Text>
                            </View>
                            <View style={styles.scoreBadgeItem}>
                              <Ionicons name="play-forward-circle" size={15} color="#9CA3AF" />
                              <Text style={styles.scoreText}>
                                {activeChallenge.results.passed_count} passé(s)
                              </Text>
                            </View>
                          </View>

                          {/* Gage sans objet imposé */}
                          {activeChallenge.results.my_dare_assigned && (
                            <View style={styles.dareBox}>
                              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                              <Text style={styles.dareText}>
                                Gage pour toi ! (À vous de décider entre vous)
                              </Text>
                            </View>
                          )}
                          {activeChallenge.results.creator_dare && (
                            <View style={styles.dareBox}>
                              <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
                              <Text style={styles.dareText}>
                                100% de bonnes réponses ! Gage pour l’auteur ! (À vous de décider entre vous)
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Phase 2: État expiré explicite */}
                      {activeChallenge.state === 'expired' && (
                        <View style={styles.expiredBox}>
                          <Ionicons name="time-outline" size={20} color="#F59E0B" />
                          <Text style={styles.expiredText}>
                            Le temps imparti pour répondre à ce défi est écoulé.
                          </Text>
                        </View>
                      )}

                      {/* Phase 2: État annulé explicite */}
                      {activeChallenge.state === 'cancelled' && (
                        <View style={styles.cancelledBox}>
                          <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                          <Text style={styles.cancelledText}>
                            Ce défi a été annulé par son auteur ou un organisateur.
                          </Text>
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

                  {/* Bouton Créer un défi (disponible aussi après défi terminé, expiré ou annulé) */}
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
                      <Text style={styles.codeLabel}>Ton code de capture :</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCopyCode(createdDraft.upload_code)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          backgroundColor: 'rgba(14, 165, 233, 0.12)',
                          borderWidth: 1,
                          borderColor: copiedCode ? '#10B981' : '#0EA5E9',
                          borderRadius: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          marginVertical: 8,
                        }}
                      >
                        <Text selectable={true} style={[styles.codeValue, { letterSpacing: 3 }]}>
                          {createdDraft.upload_code}
                        </Text>
                        <Ionicons
                          name={copiedCode ? 'checkmark-circle' : 'copy-outline'}
                          size={20}
                          color={copiedCode ? '#10B981' : '#0EA5E9'}
                        />
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2, marginBottom: 12 }}>
                        {copiedCode ? (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={{ color: '#10B981', fontSize: 13, textAlign: 'center' }}>
                              Code copié dans le presse-papier !
                            </Text>
                          </>
                        ) : (
                          <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>
                            Touche le code pour le copier, puis colle-le sur la page de capture.
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleOpenWebCamera}
                      >
                        <Ionicons name="camera" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Ouvrir la caméra sécurisée</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.secondaryButton, { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                        disabled={loading}
                        onPress={handleRegenerateCode}
                      >
                        <Ionicons name="refresh" size={16} color="#0EA5E9" />
                        <Text style={{ color: '#0EA5E9', fontSize: 13, fontWeight: '600' }}>
                          Régénérer un nouveau code
                        </Text>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  keyboardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
  badgeExpired: {
    backgroundColor: '#D97706',
  },
  badgeCancelled: {
    backgroundColor: '#DC2626',
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
    aspectRatio: 4 / 3,
    maxHeight: 380,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  scoreBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scoreText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
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
  expiredBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  expiredText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  cancelledBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelledText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
