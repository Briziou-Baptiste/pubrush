import { useUnsavedNavigation } from '../../../hooks/useUnsavedNavigation';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { resetPassword } from '../../../lib/api';
import { styles } from '../styles/login.styles';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = params.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  useUnsavedNavigation(!completed && Boolean(code || newPassword || confirmPassword), !completed && loading);

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

      setCompleted(true);
      Alert.alert('Succès', result.message, [
        {
          text: 'Se connecter',
          onPress: () => {
            navigation.reset({ index: 0, routes: [{ name: 'login' }] });
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
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        keyboardVerticalOffset={headerHeight}
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>

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
                  editable={!initialEmail} // If email comes from route params, disable editing for simplicity
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
                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Minimum 8 caractères"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={[styles.input, styles.passwordInput]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    accessibilityLabel={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    accessibilityRole="button"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      confirmPassword.length > 0 && newPassword !== confirmPassword
                        ? styles.inputError
                        : null,
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    accessibilityLabel={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    accessibilityRole="button"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
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
