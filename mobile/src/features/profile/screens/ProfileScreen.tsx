import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../styles/profile.styles';
import { fetchMe, fetchUserStats, UserStats } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ProfileScreen() {
  const [username, setUsername] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Stats state
  const [stats, setStats] = useState<UserStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadUserData();
    }, [])
  );

  async function loadUserData() {
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      
      // Load user profile & stats concurrently
      const [userData, userStats] = await Promise.all([
        fetchMe(token),
        fetchUserStats(token)
      ]);

      setUsername(userData.username);
      setStats(userStats);
    } catch (err) {
      console.error('[Profile] Error loading user profile and stats:', err);
      setErrorMsg('Impossible de charger les données utilisateur.');
    } finally {
      setLoadingUser(false);
    }
  }

  function handleExpensesPress() {
    router.push('/expenses');
  }

  const initialLetter = username ? username.charAt(0).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Infos personnelles</Text>
        </View>

        {loadingUser ? (
          <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <View style={styles.userCard}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <>
            {/* User Card */}
            <View style={styles.userCard}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{initialLetter}</Text>
              </View>
              <Text style={styles.username}>{username}</Text>
              <Text style={styles.roleSubtitle}>Membre de PubRush</Text>
            </View>

            {/* Stats Dashboard Grid */}
            {stats && (
              <View style={styles.statsGrid}>
                {/* Stats 1: Created */}
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.barathons_created}</Text>
                  <Text style={styles.statLabel}>Créés</Text>
                </View>

                {/* Stats 2: Completed */}
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.barathons_completed}</Text>
                  <Text style={styles.statLabel}>Réalisés</Text>
                </View>

                {/* Stats 3: Bars Visited */}
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.bars_visited}</Text>
                  <Text style={styles.statLabel}>Bars visités</Text>
                </View>
              </View>
            )}

            {/* Profil Section Menu */}
            <View style={styles.menuCard}>
              {/* Button 1: Manage profile */}
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => router.push('/profile-details')}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>👤</Text>
                  <Text style={styles.menuText}>Gérer mon profil</Text>
                </View>
                <Text style={styles.menuChevron}>❯</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.menuSeparator} />

              {/* Button 2: Expenses */}
              <TouchableOpacity
                style={styles.menuButton}
                onPress={handleExpensesPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>💳</Text>
                  <Text style={styles.menuText}>Dépenses</Text>
                </View>
                <Text style={styles.menuChevron}>❯</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.menuSeparator} />

              {/* Button 3: Saved Barathons */}
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => router.push('/saved-barathons')}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>💾</Text>
                  <Text style={styles.menuText}>Barathons enregistrés</Text>
                </View>
                <Text style={styles.menuChevron}>❯</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
