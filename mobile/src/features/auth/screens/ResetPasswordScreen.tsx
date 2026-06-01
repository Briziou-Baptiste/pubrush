import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
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

import { resetPassword } from '../../../lib/api';
import { styles } from '../styles/login.styles';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = params.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isFormValid =
    email.trim() &&
    code.trim().length === 6 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  async function handleResetPassword() {
    if (!email.trim()) {
      Alert.alert('Erreur', 'L’adresse email est requise.');
      return;
    }

    if (code.trim().length !== 6) {
      Alert.alert('Code invalide', 'Le code doit contenir exactement 6 chiffres.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mots de passe différents', 'Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      setLoading(true);

      const result = await resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: newPassword,
      });

      Alert.alert('Succès', result.message, [
        {
          text: 'Se connecter',
          onPress: () => {
            router.replace('/login');
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Échec de la modification',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#6B7280' }}>← Retour</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.brand}>Réinitialisation</Text>
              <Text style={styles.subtitle}>
                Renseigne le code à 6 chiffres reçu par email et saisis ton nouveau mot de passe.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Adresse email</Text>
                <TextInput
                  placeholder="ton@email.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  editable={!initialEmail} // Si l'email vient du paramètre de route, on bloque l'édition pour plus de simplicité
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Code de validation (6 chiffres)</Text>
                <TextInput
                  placeholder="Ex: 123456"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={code}
                  onChangeText={setCode}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nouveau mot de passe (8+ car.)</Text>
                <TextInput
                  placeholder="Minimum 8 caractères"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <TextInput
                  placeholder="Confirmer le mot de passe"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={[
                    styles.input,
                    confirmPassword.length > 0 && newPassword !== confirmPassword
                      ? styles.inputError
                      : null,
                  ]}
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                  <Text style={styles.errorText}>Les mots de passe ne correspondent pas.</Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading ? styles.primaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Modification...' : 'Modifier le mot de passe'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
