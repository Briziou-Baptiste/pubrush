//
//  HomeScreen.tsx
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import * as SecureStore from 'expo-secure-store';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { loginUser } from '../../../lib/api';
import { isValidEmail } from '../../../lib/validators';
import { styles } from '../styles/login.styles';
import { saveSession } from '../../../lib/authStorage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailTouched = email.length > 0;
  const emailIsValid = isValidEmail(normalizedEmail);

  async function handleLogin() {
    if (!emailIsValid) {
      Alert.alert('Email invalide', 'Entre une adresse email valide.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Mot de passe requis', 'Entre ton mot de passe.');
      return;
    }

    try {
      setLoading(true);

      const result = await loginUser({
        email: normalizedEmail,
        password,
      });

        await saveSession(result.access_token);
      router.replace('/home');
    } catch (error) {
      Alert.alert(
        'Connexion impossible',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Image
                source={require('../../../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brand}>PubRush</Text>
              <Text style={styles.subtitle}>
                Connecte-toi pour retrouver tes tournées
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                  placeholder="Ton mot de passe"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  textContentType="password"
                  autoComplete="password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                />
                <Link href="/forgot-password" style={styles.forgotPasswordLink}>
                  Mot de passe oublié ?
                </Link>
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading ? styles.primaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Connexion...' : 'Se connecter'}
                </Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Pas encore de compte ? </Text>
                <Link href="/register" style={styles.footerLink}>
                  Créer un compte
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
