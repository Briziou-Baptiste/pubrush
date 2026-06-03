import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { styles } from '../styles/profile.styles';
import { fetchMe } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ProfileScreen() {
  const [username, setUsername] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    void loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const data = await fetchMe(token);
      setUsername(data.username);
    } catch (err) {
      console.error('[Profile] Error loading user profile:', err);
      setErrorMsg('Impossible de charger les données utilisateur.');
    } finally {
      setLoadingUser(false);
    }
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

            {/* Profil Section Menu */}
            <View style={styles.menuCard}>
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
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
