import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { loginUser, registerUser, checkUsernameAvailability } from '../../../lib/api';
import { saveSession } from '../../../lib/authStorage';
import { isValidEmail, isValidPassword } from '../../../lib/validators';
import { styles } from '../styles/register.styles';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameIsTaken, setUsernameIsTaken] = useState<boolean | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedUsername = useMemo(() => username.trim(), [username]);

  const emailTouched = email.length > 0;
  const passwordTouched = password.length > 0;
  const usernameTouched = username.length > 0;

  const emailIsValid = isValidEmail(normalizedEmail);
  const passwordIsValid = isValidPassword(password);
  const usernameIsValid = normalizedUsername.length >= 3;

  useEffect(() => {
    if (normalizedUsername.length < 3) {
      setUsernameIsTaken(null);
      return;
    }

    const delayDebounceId = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailability(normalizedUsername);
        setUsernameIsTaken(!isAvailable);
      } catch (error) {
        console.error('[RegisterScreen] Error checking username availability:', error);
      }
    }, 400);

    return () => clearTimeout(delayDebounceId);
  }, [normalizedUsername]);

  async function handleRegister() {
    if (!emailIsValid) {
      Alert.alert('Email invalide', 'Entre une adresse email valide.');
      return;
    }

    if (!usernameIsValid) {
      Alert.alert(
        'Username invalide',
        'Le username doit contenir au moins 3 caractères.'
      );
      return;
    }

    if (usernameIsTaken) {
      Alert.alert(
        'Username indisponible',
        "Ce nom d'utilisateur est déjà pris."
      );
      return;
    }

    if (!passwordIsValid) {
      Alert.alert(
        'Mot de passe trop court',
        'Le mot de passe doit contenir au moins 8 caractères.'
      );
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        email: normalizedEmail,
        username: normalizedUsername,
        password,
      });

      const result = await loginUser({
        email: normalizedEmail,
        password,
      });

      await saveSession(result.access_token);
      router.replace('/home');
    } catch (error) {
      Alert.alert(
        'Inscription impossible',
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
                Crée ton compte et démarre ton expérience
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
                <Text style={styles.label}>Username</Text>
                <TextInput
                  placeholder="Ton pseudo"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                  style={[
                    styles.input,
                    (usernameTouched && !usernameIsValid) || usernameIsTaken ? styles.inputError : null,
                  ]}
                />
                {usernameTouched && !usernameIsValid ? (
                  <Text style={styles.errorText}>
                    Le username doit contenir au moins 3 caractères.
                  </Text>
                ) : usernameIsTaken ? (
                  <Text style={styles.errorText}>
                    Ce nom d'utilisateur est déjà pris.
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                  placeholder="Minimum 8 caractères"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="password-new"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  style={[
                    styles.input,
                    passwordTouched && !passwordIsValid ? styles.inputError : null,
                  ]}
                />
                {passwordTouched && !passwordIsValid ? (
                  <Text style={styles.errorText}>
                    Le mot de passe doit contenir au moins 8 caractères.
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading ? styles.primaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Création...' : 'Créer mon compte'}
                </Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Déjà inscrit ? </Text>
                <Link href="/login" style={styles.footerLink}>
                  Se connecter
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
