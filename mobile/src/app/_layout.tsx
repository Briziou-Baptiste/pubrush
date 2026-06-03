import { getAccessToken, subscribeToAuthChanges } from '../lib/authStorage';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  connectUserSocket,
  disconnectUserSocket,
  WSMessage,
} from '../features/active_barathon/services/webSocket.service';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export default function RootLayout() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadToken = async () => {
      try {
        const storedToken = await getAccessToken();
        if (isMounted) {
          setToken(storedToken);
        }
      } catch (error) {
        console.error('[WS][LAYOUT] Failed to load access token from storage', error);
      }
    };

    loadToken();

    const unsubscribe = subscribeToAuthChanges((newToken) => {
      if (isMounted) {
        setToken(newToken);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {

    if (!token || !API_BASE_URL) {
      disconnectUserSocket();
      return;
    }

    connectUserSocket({
      apiBaseUrl: API_BASE_URL,
      token,
      onMessage: (message: WSMessage) => {
          if (message.type === 'BARATHON_STARTED' && message.barathon_id) {
            router.replace({
              pathname: '/active-barathon',
              params: { barathonId: String(message.barathon_id) },
            });
            return;
          }

        if (message.type === 'BARATHON_STOPPED' || message.type === 'BARATHON_FINISHED') {
          router.replace('/planned');
          return;
        }

        if (message.type === 'BARATHON_LIST_REFRESH') {
          console.log('[WS][LAYOUT] BARATHON_LIST_REFRESH', message.barathon_id);
        }
      },
      onOpen: () => {
        console.log('[WS][LAYOUT] User WebSocket connected');
      },
      onClose: () => {
        console.log('[WS][LAYOUT] User WebSocket closed');
      },
    });

    return () => {
      console.log('[WS][LAYOUT] cleanup -> disconnectUserSocket()');
      disconnectUserSocket();
    };
  }, [token]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="planned" options={{ gestureEnabled: false }} />
      <Stack.Screen name="past" />
      <Stack.Screen name="create-barathon" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="profile-details" />
      <Stack.Screen name="create-barathon-map" />
      <Stack.Screen name="create-barathon-recap" />
      <Stack.Screen name="barathon-details" />
      <Stack.Screen name="active-barathon" />
      <Stack.Screen name="barathon-stop-summary" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="barathon-expenses-placeholder" />
    </Stack>
  );
}
