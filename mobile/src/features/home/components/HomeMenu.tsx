import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../styles/home.styles';
import { getCurrentUser, getAccessToken } from '../../../lib/authStorage';
import { fetchUserStats, UserStats } from '../../../lib/api';

type HomeMenuProps = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (path: '/planned' | '/past' | '/create-barathon' | '/profile' | '/saved-barathons' | '/events') => void;
};

export default function HomeMenu({
  visible,
  onClose,
  onLogout,
  onNavigate,
}: HomeMenuProps) {
  const [user, setUser] = useState<{ id: number | null; username: string; email: string } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUserInfo();
    }
  }, [visible]);

  async function loadUserInfo() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const token = await getAccessToken();
        if (token) {
          setLoadingStats(true);
          const userStats = await fetchUserStats(token);
          setStats(userStats);
        }
      }
    } catch (err) {
      console.warn('[HomeMenu] Error loading user info/stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  const firstLetter = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.menuPanel}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: 72,
              paddingHorizontal: 16,
              paddingBottom: 28,
              flexGrow: 1,
            }}
          >
            {/* PROFIL CARD */}
            {user && (
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{firstLetter}</Text>
                  </View>
                  <View style={styles.profileTextWrapper}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {user.username}
                    </Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>
                </View>

                <View style={styles.profileDivider} />

                <View style={styles.statsContainer}>
                  {loadingStats ? (
                    <ActivityIndicator size="small" color="#6366F1" style={{ paddingVertical: 4 }} />
                  ) : (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats?.barathons_created ?? 0}</Text>
                        <Text style={styles.statLabel}>Créés</Text>
                      </View>
                      <View style={styles.statVerticalDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats?.bars_visited ?? 0}</Text>
                        <Text style={styles.statLabel}>Bars visités</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* SECTION: NAVIGATION (GRILLE 2x2) */}
            <View style={styles.gridSectionContainer}>
              <Text style={styles.sectionHeader}>BARATHONS</Text>

              <View style={styles.gridContainer}>
                {/* 1. Créer */}
                <TouchableOpacity
                  style={[styles.gridCard, { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' }]}
                  onPress={() => onNavigate('/create-barathon')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: '#6366F1' }]}>
                    <Ionicons name="map" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.gridCardTitle, { color: '#4F46E5' }]}>Créer</Text>
                  <Text style={styles.gridCardSubtitle}>Nouveau parcours</Text>
                </TouchableOpacity>

                {/* 2. Prévus */}
                <TouchableOpacity
                  style={[styles.gridCard, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}
                  onPress={() => onNavigate('/planned')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: '#3B82F6' }]}>
                    <Ionicons name="calendar" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.gridCardTitle, { color: '#2563EB' }]}>Prévus</Text>
                  <Text style={styles.gridCardSubtitle}>Prochaines soirées</Text>
                </TouchableOpacity>

                {/* 3. Favoris / Enregistrés */}
                <TouchableOpacity
                  style={[styles.gridCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}
                  onPress={() => onNavigate('/saved-barathons')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="star" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.gridCardTitle, { color: '#D97706' }]}>Enregistrés</Text>
                  <Text style={styles.gridCardSubtitle}>Mes favoris</Text>
                </TouchableOpacity>

                {/* 4. Passés */}
                <TouchableOpacity
                  style={[styles.gridCard, { backgroundColor: '#F9FAFB', borderColor: '#F3F4F6' }]}
                  onPress={() => onNavigate('/past')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: '#9CA3AF' }]}>
                    <Ionicons name="time" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.gridCardTitle, { color: '#4B5563' }]}>Passés</Text>
                  <Text style={styles.gridCardSubtitle}>Historique</Text>
                </TouchableOpacity>
              </View>

              {/* 5. Événements (Full Width Card) */}
              <TouchableOpacity
                style={styles.gridCardFullWidth}
                onPress={() => onNavigate('/events')}
                activeOpacity={0.7}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#E11D48', marginBottom: 0, marginRight: 12 }]}>
                  <Ionicons name="ribbon" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gridCardTitle, { color: '#BE123C' }]}>Événements</Text>
                  <Text style={styles.gridCardSubtitle}>Événements & partenaires</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#BE123C" style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>

            {/* SECTION: RÉGLAGES */}
            <View style={styles.settingsSectionContainer}>
              <Text style={styles.sectionHeader}>OPTIONS</Text>

              <View style={styles.settingsCard}>
                {/* Infos personnelles */}
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={() => onNavigate('/profile')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-outline" size={18} color="#4B5563" style={{ marginRight: 10 }} />
                  <Text style={styles.settingsRowText}>Infos personnelles</Text>
                  <Ionicons name="chevron-forward" size={14} color="#C7C7CC" />
                </TouchableOpacity>

                <View style={styles.settingsRowDivider} />

                {/* Déconnexion */}
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={onLogout}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 10 }} />
                  <Text style={[styles.settingsRowText, { color: '#EF4444', fontWeight: '700' }]}>
                    Déconnexion
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#EF4444" style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
