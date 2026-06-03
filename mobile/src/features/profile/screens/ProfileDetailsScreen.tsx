import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { styles } from '../styles/profileDetails.styles';
import { fetchMe } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ProfileDetailsScreen() {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
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
      setEmail(data.email);
    } catch (err) {
      console.error('[ProfileDetails] Error loading details:', err);
      setErrorMsg('Impossible de charger les données du profil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mon Profil</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <View style={styles.card}>
            <Text style={{ color: '#DC2626', fontWeight: '600', textAlign: 'center' }}>
              {errorMsg}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations du compte</Text>

            {/* Username Row */}
            <View style={styles.infoGroup}>
              <Text style={styles.label}>Nom d'utilisateur</Text>
              <Text style={styles.value}>{username}</Text>
            </View>

            {/* Email Row */}
            <View style={[styles.infoGroup, styles.infoGroupLast]}>
              <Text style={styles.label}>Adresse e-mail</Text>
              <Text style={styles.value}>{email}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
