import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { requestPasswordReset } from '../../../lib/api';
import { isValidEmail } from '../../../lib/validators';
import { styles } from '../styles/login.styles';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailTouched = email.length > 0;
  const emailIsValid = isValidEmail(normalizedEmail);

  async function handleSendCode() {
    if (!emailIsValid) {
      Alert.alert('Email invalide', 'Entre une adresse email valide.');
      return;
    }

    try {
      setLoading(true);

      const result = await requestPasswordReset(normalizedEmail);

      Alert.alert('Succès', result.message, [
        {
          text: 'Continuer',
          onPress: () => {
            router.push({
              pathname: '/reset-password',
              params: { email: normalizedEmail },
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Erreur',
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
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#6B7280' }}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.brand}>Mot de passe oublié ?</Text>
            <Text style={styles.subtitle}>
              Saisis ton adresse email pour recevoir un code de réinitialisation unique à 6 chiffres.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email du compte</Text>
              <TextInput
                placeholder="ton@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                style={[
                  styles.input,
                  emailTouched && !emailIsValid ? styles.inputError : null,
                ]}
              />
              {emailTouched && !emailIsValid ? (
                <Text style={styles.errorText}>Adresse email invalide.</Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleSendCode}
              disabled={loading}
              style={[
                styles.primaryButton,
                loading ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Envoi du code...' : 'Envoyer le code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
