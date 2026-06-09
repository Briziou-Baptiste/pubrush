import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';

import HomeMenu from '../components/HomeMenu';
import LocationButton from '../components/LocationButton';
import { useUserLocation } from '../hooks/useUserLocation';
import { styles } from '../styles/home.styles';
import { clearSession } from '../../../lib/authStorage';
import { getMyActiveBarathon } from '../../active_barathon/services/activeBarathon.service';

const DEFAULT_REGION: Region = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function HomeScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [hasCenteredInitially, setHasCenteredInitially] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const mapRef = useRef<MapView | null>(null);

  const {
    location,
    heading,
    permissionGranted,
    loadingLocation,
    locationError,
  } = useUserLocation();

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const token = await SecureStore.getItemAsync('access_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      const activeBarathon = await getMyActiveBarathon();

      if (activeBarathon?.id) {
        router.replace({
          pathname: '/active-barathon',
          params: {
            barathonId: String(activeBarathon.id),
          },
        });
        return;
      }
    } catch (error) {
      console.error('HOME BOOTSTRAP ERROR', error);
    } finally {
      setBootstrapping(false);
    }
  }

  useEffect(() => {
    if (!location || hasCenteredInitially) return;

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: 16,
      },
      { duration: 900 }
    );

    setHasCenteredInitially(true);
  }, [location, hasCenteredInitially]);

  useEffect(() => {
    if (locationError) {
      Alert.alert('Localisation', locationError);
    }
  }, [locationError]);

  const initialRegion = useMemo(() => {
    if (!location) return DEFAULT_REGION;

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [location]);

  async function handleLogout() {
    await clearSession();
    setMenuVisible(false);
    router.replace('/login');
  }

  function navigateTo(path: '/planned' | '/past' | '/create-barathon' | '/profile' | '/saved-barathons' | '/events') {
    setMenuVisible(false);
    router.push(path);
  }

  function centerOnUser() {
    if (!location) {
      Alert.alert('Localisation', 'Position indisponible pour le moment.');
      return;
    }

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: 17,
      },
      { duration: 700 }
    );
  }

  if (bootstrapping) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safeArea}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={permissionGranted}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      />

      <View style={styles.topBarWrapper}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>PubRush</Text>
            <Text style={styles.brandSubtitle}>
              La carte de tes meilleures soirées
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.menuButton}
            activeOpacity={0.85}
          >
            <Text style={styles.menuButtonIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.locationControlWrapper}>
        <LocationButton
          onPress={centerOnUser}
          heading={heading}
          disabled={!permissionGranted || loadingLocation}
        />
      </View>

      <HomeMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />
    </View>
  );
}
