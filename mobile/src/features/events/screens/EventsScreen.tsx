import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  SafeAreaView, 
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
  Keyboard,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { fetchPartnerEvents, redeemTicketCode, joinPartnerEvent } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';
import { styles } from '../styles/events.styles';

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
        const eventId = selectedEvent?.id;
        const eventName = selectedEvent?.name;
        setSelectedEvent(null);
        setTicketCodeInput('');
        setActivationSuccess(false);

        if (eventId) {
          router.push({
            pathname: '/partner-event-map',
            params: { eventId: String(eventId), eventName: eventName }
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

      // Redirect to partner-event-map
      router.push({
        pathname: '/partner-event-map',
        params: { eventId: String(event.id), eventName: event.name }
      });
    } catch (err: any) {
      console.error('[Events] Error joining event:', err);
      // Fallback: still redirect even if join record fails
      router.push({
        pathname: '/partner-event-map',
        params: { eventId: String(event.id), eventName: event.name }
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
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
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
                      <View>
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
                      </View>

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
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
