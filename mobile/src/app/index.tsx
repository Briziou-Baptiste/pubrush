import { router } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { getAccessToken } from '../lib/authStorage';

export default function IndexScreen() {
  useEffect(() => {
    async function bootstrap() {
      const token = await getAccessToken();

      if (token) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }

    bootstrap();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Chargement...</Text>
    </SafeAreaView>
  );
}
