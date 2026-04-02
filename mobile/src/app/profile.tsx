//
//  profile.tsx
//  
//
//  Created by Baptiste Briziou on 30/03/2026.
//

import { router } from 'expo-router';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Infos personnelles</Text>
        <Text style={styles.subtitle}>
          Cette section affichera les informations du compte utilisateur.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  container: { flex: 1, padding: 24 },
  backButton: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 24,
  },
  backButtonText: { color: '#FFF', fontWeight: '700' as const },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
};
