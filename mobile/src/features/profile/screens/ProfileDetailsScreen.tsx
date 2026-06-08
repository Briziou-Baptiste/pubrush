import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { styles } from '../styles/profileDetails.styles';
import { styles as profileStyles } from '../styles/profile.styles';
import { changePassword, fetchMe, updateUsername, deleteAccount, checkUsernameAvailability } from '../../../lib/api';
import { getAccessToken, clearSession } from '../../../lib/authStorage';

export default function ProfileDetailsScreen() {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Username edit fields
  const [newUsername, setNewUsername] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string>('');
  const [usernameSuccess, setUsernameSuccess] = useState<string>('');
  const [usernameSubmitting, setUsernameSubmitting] = useState<boolean>(false);
  const [usernameIsTaken, setUsernameIsTaken] = useState<boolean | null>(null);

  // Password fields
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Status message for password
  const [passErrorMsg, setPassErrorMsg] = useState<string>('');
  const [passSuccessMsg, setPassSuccessMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Account deletion state
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    const clean = newUsername.trim();
    if (clean.length < 3) {
      setUsernameIsTaken(null);
      return;
    }

    if (clean.toLowerCase() === username.toLowerCase()) {
      setUsernameIsTaken(false);
      return;
    }

    const delayDebounceId = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailability(clean);
        setUsernameIsTaken(!isAvailable);
      } catch (error) {
        console.error('[ProfileDetailsScreen] Error checking username availability:', error);
      }
    }, 400);

    return () => clearTimeout(delayDebounceId);
  }, [newUsername, username]);

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
      setNewUsername(data.username);
      setEmail(data.email);
    } catch (err) {
      console.error('[ProfileDetails] Error loading details:', err);
      setErrorMsg('Impossible de charger les données du profil.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUsernameUpdate() {
    setUsernameError('');
    setUsernameSuccess('');

    if (!newUsername.trim()) {
      setUsernameError("Le nom d'utilisateur ne peut pas être vide.");
      return;
    }

    if (newUsername.trim().length < 3) {
      setUsernameError("Le nom d'utilisateur doit comporter au moins 3 caractères.");
      return;
    }

    if (usernameIsTaken) {
      setUsernameError("Ce nom d'utilisateur est déjà pris.");
      return;
    }

    setUsernameSubmitting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const updatedUser = await updateUsername(newUsername.trim(), token);
      setUsername(updatedUser.username);
      setNewUsername(updatedUser.username);
      setUsernameSuccess("Nom d'utilisateur mis à jour avec succès.");
    } catch (err: any) {
      console.error('[ProfileDetails] Error updating username:', err);
      setUsernameError(err.message || 'Une erreur est survenue lors de la mise à jour.');
    } finally {
      setUsernameSubmitting(false);
    }
  }

  async function handlePasswordChange() {
    setPassErrorMsg('');
    setPassSuccessMsg('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassErrorMsg('Tous les champs sont requis.');
      return;
    }

    if (newPassword.length < 8) {
      setPassErrorMsg('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassErrorMsg('Le nouveau mot de passe et sa confirmation ne correspondent pas.');
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

      setPassSuccessMsg('Votre mot de passe a été modifié avec succès.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[ProfileDetails] Error changing password:', err);
      setPassErrorMsg(err.message || 'Une erreur est survenue lors de la modification.');
    } finally {
      setSubmitting(false);
    }
  }

  function triggerDeleteAccount() {
    Alert.alert(
      'Supprimer le compte ?',
      'Cette action est définitive et effacera toutes vos données personnelles conformément au RGPD. Les barathons où vous êtes le seul participant seront supprimés. Êtes-vous sûr de vouloir continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: () => void handleDeleteAccount(),
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      await deleteAccount(token);
      await clearSession();
      router.replace('/login');
    } catch (err: any) {
      console.error('[ProfileDetails] Error deleting account:', err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue lors de la suppression du compte.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Gérer mon profil</Text>
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
              <>
                {/* Profile Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Informations du compte</Text>

                  {/* Username Field */}
                  <View style={styles.infoGroup}>
                    <Text style={styles.label}>Nom d'utilisateur</Text>
                    {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                    {usernameIsTaken ? <Text style={styles.errorText}>Ce nom d'utilisateur est déjà pris.</Text> : null}
                    {usernameSuccess ? <Text style={styles.successText}>{usernameSuccess}</Text> : null}
                    <TextInput
                      style={[
                        styles.usernameInput,
                        usernameIsTaken ? styles.inputError : null
                      ]}
                      value={newUsername}
                      onChangeText={setNewUsername}
                      placeholder="Nom d'utilisateur"
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                      style={[styles.saveButton, usernameSubmitting && styles.saveButtonDisabled]}
                      onPress={handleUsernameUpdate}
                      disabled={usernameSubmitting}
                      activeOpacity={0.8}
                    >
                      {usernameSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.saveButtonText}>Enregistrer le nom d'utilisateur</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Email Row (Non-editable as typical security standard unless email change flow is implemented) */}
                  <View style={[styles.infoGroup, styles.infoGroupLast]}>
                    <Text style={styles.label}>Adresse e-mail</Text>
                    <Text style={styles.value}>{email}</Text>
                  </View>
                </View>

                {/* Password Change Card */}
                <View style={[profileStyles.card, { marginTop: 24 }]}>
                  <Text style={profileStyles.cardTitle}>Modifier le mot de passe</Text>

                  {passErrorMsg ? <Text style={profileStyles.errorText}>{passErrorMsg}</Text> : null}
                  {passSuccessMsg ? <Text style={profileStyles.successText}>{passSuccessMsg}</Text> : null}

                  <View style={profileStyles.inputGroup}>
                    <Text style={profileStyles.label}>Ancien mot de passe</Text>
                    <TextInput
                      style={profileStyles.input}
                      secureTextEntry
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      placeholder="Saisissez votre ancien mot de passe"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={profileStyles.inputGroup}>
                    <Text style={profileStyles.label}>Nouveau mot de passe</Text>
                    <TextInput
                      style={profileStyles.input}
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Minimum 8 caractères"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={profileStyles.inputGroup}>
                    <Text style={profileStyles.label}>Confirmer le nouveau mot de passe</Text>
                    <TextInput
                      style={profileStyles.input}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirmez votre mot de passe"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <TouchableOpacity
                    style={[profileStyles.primaryButton, submitting && profileStyles.primaryButtonDisabled]}
                    onPress={handlePasswordChange}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={profileStyles.primaryButtonText}>Modifier le mot de passe</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Account Deletion Card (RGPD compliant) */}
                <View style={styles.deleteCard}>
                  <Text style={styles.deleteCardTitle}>Zone de danger</Text>
                  <Text style={styles.deleteDesc}>
                    La suppression du compte est définitive. Toutes vos données seront effacées
                    conformément à la législation RGPD. Les barathons dont vous êtes le seul participant
                    seront supprimés.
                  </Text>
                  <TouchableOpacity
                    style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
                    onPress={triggerDeleteAccount}
                    disabled={deleting}
                    activeOpacity={0.8}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Supprimer mon compte</Text>
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
