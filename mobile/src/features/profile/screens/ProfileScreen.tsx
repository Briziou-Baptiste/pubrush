import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { styles } from '../styles/profile.styles';
import { changePassword, fetchMe } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

export default function ProfileScreen() {
  const [username, setUsername] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);

  // Password fields
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Status message
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

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

  async function handlePasswordChange() {
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Tous les champs sont requis.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Le nouveau mot de passe et sa confirmation ne correspondent pas.');
      return;
    }

    setSubmitting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      await changePassword(
        {
          old_password: oldPassword,
          new_password: newPassword,
        },
        token
      );

      setSuccessMsg('Votre mot de passe a été modifié avec succès.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[Profile] Error changing password:', err);
      setErrorMsg(err.message || 'Une erreur est survenue lors de la modification.');
    } finally {
      setSubmitting(false);
    }
  }

  const initialLetter = username ? username.charAt(0).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
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
                      <Text style={styles.menuText}>Mon Profil (Adresse Email)</Text>
                    </View>
                    <Text style={styles.menuChevron}>❯</Text>
                  </TouchableOpacity>
                </View>

                {/* Password Change Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Modifier le mot de passe</Text>

                  {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                  {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ancien mot de passe</Text>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      placeholder="Saisissez votre ancien mot de passe"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nouveau mot de passe</Text>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Minimum 8 caractères"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirmez votre mot de passe"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                    onPress={handlePasswordChange}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Modifier le mot de passe</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
