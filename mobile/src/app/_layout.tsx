import { CommonActions } from '@react-navigation/native';
import { getAccessToken, subscribeToAuthChanges } from '../lib/authStorage';
import { Stack, router, useNavigationContainerRef, usePathname } from 'expo-router';
import { BackHandler, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fallbackRoute, navigationTitles, NavigationRoute } from '../lib/navigation';
import { useEffect, useState } from 'react';

import {
  connectUserSocket,
  disconnectUserSocket,
  WSMessage,
} from '../features/active_barathon/services/webSocket.service';
import { initializeLocationCache } from '../features/home/hooks/useUserLocation';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const pathname = usePathname();
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigationRef.isReady() || navigationRef.canGoBack()) return false;
      const route = navigationRef.getCurrentRoute() as NavigationRoute | undefined;
      if (!route || !navigationTitles[route.name]) return false;
      navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [fallbackRoute(route.name, route.params)] }));
      return true;
    });
    return () => listener.remove();
  }, [navigationRef, pathname]);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Proactive location warm-up for instant startup map display
    void initializeLocationCache();

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
          console.log('[WS][LAYOUT] Event received:', message.type);
          if (message.type === 'BARATHON_STARTED' && message.barathon_id) {
            router.replace({
              pathname: '/active-barathon',
              params: { barathonId: String(message.barathon_id) },
            });
            return;
          }

        if (message.type === 'BARATHON_STOPPED' || message.type === 'BARATHON_FINISHED') {
          router.replace({
            pathname: '/barathon-stop-summary',
            params: {
              barathonId: String(message.barathon_id),
              source: 'active',
            },
          });
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
    <Stack screenOptions={({ route, navigation }) => ({
      headerShown: Boolean(navigationTitles[route.name]),
      title: navigationTitles[route.name],
      headerStyle: { backgroundColor: '#F4F6FA' },
      headerTintColor: '#111827',
      headerShadowVisible: false,
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.reset({ index: 0, routes: [fallbackRoute(route.name, route.params)] });
          }}
          style={({ pressed }) => ({
            width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
            borderRadius: 16, backgroundColor: '#111827', opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
      ),
    })}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="events" />
      <Stack.Screen name="start-barathon-roles" />
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
      <Stack.Screen name="barathon-expenses" />
      <Stack.Screen name="saved-barathons" />
      <Stack.Screen name="partner-event-map" />
    </Stack>
  );
}
