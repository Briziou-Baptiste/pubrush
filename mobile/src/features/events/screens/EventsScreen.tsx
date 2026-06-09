import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { fetchPartnerEvents, redeemTicketCode, joinPartnerEvent } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Modal States
  const [activationModalOpen, setActivationModalOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'clavier' | 'scanner'>('clavier');
  const [ticketCodeInput, setTicketCodeInput] = useState<string>('');
  const [validatingTicket, setValidatingTicket] = useState<boolean>(false);
  const [activationError, setActivationError] = useState<string>('');
  const [activationSuccess, setActivationSuccess] = useState<boolean>(false);
  const [simulatedScanning, setSimulatedScanning] = useState<boolean>(false);

  // Animation values
  const scanAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      void loadEvents(false);
    }, [])
  );

  useEffect(() => {
    if (activationModalOpen && activeTab === 'scanner') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [activationModalOpen, activeTab]);

  async function loadEvents(isRefreshing = false) {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg('');

    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const activeEvents = await fetchPartnerEvents(token);
      setEvents(activeEvents);
    } catch (err) {
      console.error('[Events] Error loading partner events:', err);
      setErrorMsg('Impossible de charger les événements partenaires.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    void loadEvents(true);
  }, []);

  const openActivationModal = (event: any) => {
    setSelectedEvent(event);
    setTicketCodeInput('');
    setActivationError('');
    setActivationSuccess(false);
    setSimulatedScanning(false);
    setActiveTab('clavier');
    setActivationModalOpen(true);
  };

  const handleActivateTicket = async (codeToRedeem?: string) => {
    const code = (codeToRedeem || ticketCodeInput).trim().toUpperCase();
    if (!code) {
      setActivationError('Veuillez saisir un code.');
      return;
    }

    setValidatingTicket(true);
    setActivationError('');
    setActivationSuccess(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      await redeemTicketCode(code, token);
      setActivationSuccess(true);
      
      // Reload events to update locked/unlocked state in UI
      void loadEvents(false);
      
      // Close modal and redirect after successful verification
      setTimeout(() => {
        setActivationModalOpen(false);
        const eventCode = selectedEvent?.code;
        setSelectedEvent(null);
        setTicketCodeInput('');
        setActivationSuccess(false);

        if (eventCode) {
          router.push({
            pathname: '/create-barathon',
            params: { eventCode: eventCode }
          });
        }
      }, 1200);
    } catch (err: any) {
      console.error('[Events] Error activating ticket:', err);
      setActivationError(err.message || 'Code de ticket invalide ou déjà utilisé.');
    } finally {
      setValidatingTicket(false);
    }
  };

  const handleJoinEvent = async (event: any) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      // If it requires a ticket and is not unlocked, open the modal
      if (event.requires_ticket && !event.is_unlocked) {
        openActivationModal(event);
        return;
      }

      // Call API to register user in partner_event_users
      await joinPartnerEvent(event.id, token);

      // Redirect to create-barathon
      router.push({
        pathname: '/create-barathon',
        params: { eventCode: event.code }
      });
    } catch (err: any) {
      console.error('[Events] Error joining event:', err);
      // Fallback: still redirect to create-barathon even if join record fails (e.g. unique constraint or connection glitch)
      router.push({
        pathname: '/create-barathon',
        params: { eventCode: event.code }
      });
    }
  };

  const handleSimulateScan = () => {
    if (!ticketCodeInput.trim()) {
      setActivationError('Veuillez d\'abord saisir un code dans l\'onglet Clavier, ou le coller pour simuler le scan.');
      return;
    }

    setSimulatedScanning(true);
    setActivationError('');
    
    // Simulate camera scanning delay before calling validation
    setTimeout(() => {
      setSimulatedScanning(false);
      void handleActivateTicket(ticketCodeInput);
    }, 1500);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 178], // Height of viewfinder - border width
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={16} color="#FFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Événements</Text>
          <Text style={styles.subtitle}>Découvre les événements partenaires officiels et rejoins la fête !</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#BE123C" />
            <Text style={styles.loadingText}>Chargement des événements...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadEvents(false)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#BE123C']} />
            }
            renderItem={({ item }) => (
              <View style={styles.eventCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.badgeContainer}>
                    <Ionicons name="ribbon" size={18} color="#BE123C" />
                    <Text style={styles.eventTitle}>{item.name}</Text>
                  </View>
                  <View style={styles.headerBadges}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{item.code}</Text>
                    </View>
                    {item.requires_ticket && (
                      <View style={[styles.statusBadge, item.is_unlocked ? styles.unlockedBadge : styles.lockedBadge]}>
                        <Ionicons 
                          name={item.is_unlocked ? "lock-open-outline" : "lock-closed-outline"} 
                          size={10} 
                          color={item.is_unlocked ? "#10B981" : "#D97706"} 
                        />
                        <Text style={item.is_unlocked ? styles.unlockedText : styles.lockedText}>
                          {item.is_unlocked ? "Débloqué" : "Privé"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.eventDesc}>{item.description}</Text>
                ) : null}

                {(item.start_date || item.end_date) ? (
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                    <Text style={styles.dateText}>
                      {item.start_date ? formatDate(item.start_date) : 'Début indéfini'} au {item.end_date ? formatDate(item.end_date) : 'Fin indéfinie'}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.footerInfo}>
                    <Ionicons name="information-circle-outline" size={12} color="#6B7280" />
                    {' '}Actif
                  </Text>
                  
                  <TouchableOpacity 
                    style={[
                      styles.joinButton, 
                      item.requires_ticket && !item.is_unlocked && styles.unlockButton
                    ]}
                    onPress={() => void handleJoinEvent(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.joinButtonText}>
                      {item.requires_ticket && !item.is_unlocked ? "Rejoindre (Privé)" : "Rejoindre"}
                    </Text>
                    {item.requires_ticket && !item.is_unlocked ? (
                      <Ionicons name="lock-closed" size={14} color="#FFF" />
                    ) : (
                      <Ionicons name="arrow-forward" size={14} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.iconBadge}>
                  <Ionicons name="ribbon" size={40} color="#BE123C" />
                </View>
                <Text style={styles.emptyTitle}>Aucun événement actif</Text>
                <Text style={styles.emptyText}>
                  Il n'y a pas d'événement partenaire officiel disponible pour le moment. Repasse plus tard !
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Ticket Activation Modal */}
      <Modal
        visible={activationModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivationModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalContainer}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="ticket" size={22} color="#BE123C" />
                  <Text style={styles.modalTitleText}>Activer l'événement</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setActivationModalOpen(false)}
                  style={styles.closeModalBtn}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubTitle}>
                Cet événement est privé. Veuillez saisir votre code à usage unique pour débloquer l'accès.
              </Text>

              {/* Tabs */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'clavier' && styles.activeTabButton]}
                  onPress={() => setActiveTab('clavier')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="keypad-outline" size={15} color={activeTab === 'clavier' ? '#BE123C' : '#6B7280'} />
                  <Text style={[styles.tabButtonText, activeTab === 'clavier' && styles.activeTabButtonText]}>
                    Clavier
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'scanner' && styles.activeTabButton]}
                  onPress={() => setActiveTab('scanner')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="qr-code-outline" size={15} color={activeTab === 'scanner' ? '#BE123C' : '#6B7280'} />
                  <Text style={[styles.tabButtonText, activeTab === 'scanner' && styles.activeTabButtonText]}>
                    Scanner QR
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Contents */}
              <View style={styles.tabContent}>
                {activeTab === 'clavier' ? (
                  <View style={styles.manualTab}>
                    <Text style={styles.inputLabel}>Code de ticket</Text>
                    <TextInput
                      value={ticketCodeInput}
                      onChangeText={(val) => {
                        setTicketCodeInput(val);
                        setActivationError('');
                      }}
                      placeholder="PR-XXXX-YYYY"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      style={styles.textInput}
                    />

                    {activationError ? (
                      <Text style={styles.errorText}>{activationError}</Text>
                    ) : null}

                    {activationSuccess ? (
                      <Text style={styles.successText}>Code validé ! Événement débloqué.</Text>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.submitButton, 
                        (validatingTicket || !ticketCodeInput.trim()) && styles.disabledButton,
                        activationSuccess && styles.successButton
                      ]}
                      onPress={() => void handleActivateTicket()}
                      disabled={validatingTicket || !ticketCodeInput.trim() || activationSuccess}
                      activeOpacity={0.8}
                    >
                      {validatingTicket ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          {activationSuccess ? "Débloqué" : "Déverrouiller l'accès"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannerTab}>
                    <View style={styles.viewfinderContainer}>
                      <View style={styles.viewfinder}>
                        <View style={[styles.viewfinderCorner, styles.cornerTL]} />
                        <View style={[styles.viewfinderCorner, styles.cornerTR]} />
                        <View style={[styles.viewfinderCorner, styles.cornerBL]} />
                        <View style={[styles.viewfinderCorner, styles.cornerBR]} />
                        
                        {(simulatedScanning || validatingTicket) ? (
                          <View style={styles.scannerOverlay}>
                            <ActivityIndicator size="large" color="#BE123C" />
                            <Text style={styles.scanningOverlayText}>
                              {simulatedScanning ? "Analyse..." : "Validation..."}
                            </Text>
                          </View>
                        ) : (
                          <Animated.View style={[styles.laserLine, { transform: [{ translateY }] }]} />
                        )}
                      </View>
                    </View>

                    {activationError ? (
                      <Text style={[styles.errorText, { textAlign: 'center', marginTop: 10 }]}>
                        {activationError}
                      </Text>
                    ) : null}

                    {activationSuccess ? (
                      <Text style={[styles.successText, { textAlign: 'center', marginTop: 10 }]}>
                        Code scanné avec succès !
                      </Text>
                    ) : null}

                    <Text style={styles.scanHelpText}>
                      Veuillez renseigner le code dans l'onglet Clavier pour pouvoir simuler le scan.
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.simScanButton, 
                        (simulatedScanning || validatingTicket || !ticketCodeInput.trim() || activationSuccess) && styles.disabledButton,
                        activationSuccess && styles.successButton
                      ]}
                      onPress={handleSimulateScan}
                      disabled={simulatedScanning || validatingTicket || !ticketCodeInput.trim() || activationSuccess}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.simScanButtonText}>
                        {activationSuccess ? "Ticket Validé" : "Simuler le Scan du Code"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topRow: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 10,
  },
  successText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#BE123C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBadge: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  codeText: {
    color: '#BE123C',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  lockedBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  lockedText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  unlockedBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  unlockedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  eventDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  dateText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  footerInfo: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#BE123C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  unlockButton: {
    backgroundColor: '#D97706',
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
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
    borderWidth: 1,
    borderColor: '#EBF0F5',
    marginTop: 20,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FFE4E6',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalSubTitle: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabButtonText: {
    color: '#BE123C',
    fontWeight: '700',
  },
  tabContent: {
    minHeight: 260,
  },
  manualTab: {
    flex: 1,
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#BE123C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 'auto',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  scannerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  viewfinder: {
    width: 200,
    height: 180,
    borderWidth: 1,
    borderColor: 'rgba(190, 18, 60, 0.2)',
    borderRadius: 16,
    backgroundColor: '#111827',
    overflow: 'hidden',
    position: 'relative',
  },
  viewfinderCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#BE123C',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningOverlayText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  scanHelpText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginHorizontal: 10,
    marginVertical: 14,
  },
  simScanButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 'auto',
  },
  simScanButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
