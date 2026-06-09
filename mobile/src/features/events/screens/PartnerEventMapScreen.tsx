import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert, 
  Linking, 
  Platform 
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { fetchPartnerEventSpots, fetchMapFilters } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';
import { useUserLocation } from '../../home/hooks/useUserLocation';
import LocationButton from '../../home/components/LocationButton';
import { styles as rawStyles } from '../styles/partnerEventMap.styles';
const styles = rawStyles as any;

const DEFAULT_REGION = {
  latitude: 43.6047,
  longitude: 1.4442,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function PartnerEventMapScreen() {
  const { eventId, eventName } = useLocalSearchParams<{ eventId: string; eventName: string }>();
  const mapRef = useRef<MapView | null>(null);

  const [spots, setSpots] = useState<any[]>([]);
  const [mapFilters, setMapFilters] = useState<any[]>([]);
  const [selectedFilterKeys, setSelectedFilterKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const {
    location,
    heading,
    permissionGranted,
    loadingLocation,
    locationError,
  } = useUserLocation();

  useEffect(() => {
    if (!eventId) {
      setErrorMsg('Identifiant de l\'événement manquant.');
      setLoading(false);
      return;
    }
    void loadMapData();
  }, [eventId]);

  async function loadMapData() {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const id = Number(eventId);
      const loadedSpots = await fetchPartnerEventSpots(id, token);
      setSpots(loadedSpots);

      const loadedFilters = await fetchMapFilters(id, token);
      if (loadedFilters.length > 0) {
        setMapFilters(loadedFilters);
        setSelectedFilterKeys(loadedFilters.map(f => f.key));
      } else {
        // Fallback filters matching the spot_type values
        const fallbackFilters: any[] = [];
        const spotTypes = Array.from(new Set(loadedSpots.map((s: any) => s.spot_type)));
        
        spotTypes.forEach((type) => {
          if (type === 'bar') {
            fallbackFilters.push({ id: 1, key: 'bar', label: 'Bars', icon: 'beer-outline' });
          } else if (type === 'security') {
            fallbackFilters.push({ id: 2, key: 'security', label: 'Sécurité', icon: 'shield-half-outline' });
          } else if (type === 'water') {
            fallbackFilters.push({ id: 3, key: 'water', label: 'Points d\'eau', icon: 'water-outline' });
          } else if (type === 'first_aid') {
            fallbackFilters.push({ id: 4, key: 'first_aid', label: 'Secours', icon: 'medical-outline' });
          } else {
            fallbackFilters.push({ id: 5, key: 'other', label: 'Autres', icon: 'location-outline' });
          }
        });

        setMapFilters(fallbackFilters);
        setSelectedFilterKeys(fallbackFilters.map(f => f.key));
      }

      // Animate map camera to focus on first spot after brief loading delay
      if (loadedSpots.length > 0) {
        setTimeout(() => {
          mapRef.current?.animateCamera({
            center: {
              latitude: loadedSpots[0].latitude,
              longitude: loadedSpots[0].longitude,
            },
            zoom: 16,
          }, { duration: 900 });
        }, 300);
      }
    } catch (err: any) {
      console.error('[EventMap] Error loading map data:', err);
      setErrorMsg(err.message || 'Impossible de charger les points d\'intérêt.');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterToggle = (key: string) => {
    setSelectedFilterKeys((prevKeys) => {
      if (prevKeys.includes(key)) {
        return prevKeys.filter(k => k !== key);
      } else {
        return [...prevKeys, key];
      }
    });
  };

  const getMarkerEmoji = (type: string) => {
    switch (type) {
      case 'bar': return '🍻';
      case 'security': return '🛡️';
      case 'water': return '💧';
      case 'first_aid': return '🏥';
      default: return '📍';
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'bar': return '#F59E0B'; // Amber
      case 'security': return '#3B82F6'; // Blue
      case 'water': return '#06B6D4'; // Cyan
      case 'first_aid': return '#EF4444'; // Red
      default: return '#6B7280'; // Slate/Gray
    }
  };

  const handleOpenDirections = (spot: any) => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`;
    
    Alert.alert(
      "Rejoindre ce point",
      `Voulez-vous lancer l'itinéraire vers "${spot.name}" avec Google Maps ?`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Y aller", 
          onPress: () => {
            Linking.openURL(googleMapsUrl).catch((err) => {
              console.error("Failed to open directions link:", err);
              Alert.alert("Erreur", "Impossible d'ouvrir Google Maps.");
            });
          }
        }
      ]
    );
  };

  const centerOnUser = () => {
    if (!location) {
      Alert.alert('Localisation', 'Position indisponible pour le moment.');
      return;
    }
    mapRef.current?.animateCamera({
      center: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      zoom: 17,
    }, { duration: 750 });
  };

  // Filter spots based on selection
  const visibleSpots = spots.filter(spot => {
    // If the event filters contain a filter for this spot type, check if it's toggled active
    const hasFilter = mapFilters.some(f => f.key === spot.spot_type);
    if (hasFilter) {
      return selectedFilterKeys.includes(spot.spot_type);
    }
    return true;
  });

  if (loading && spots.length === 0) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="large" color="#BE123C" />
        <Text style={styles.loadingText}>Chargement de la carte interactive...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.errorWrapper}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={() => void loadMapData()}>
          <Text style={styles.errorBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Interactive Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={
            location 
              ? { 
                  latitude: location.latitude, 
                  longitude: location.longitude, 
                  latitudeDelta: 0.015, 
                  longitudeDelta: 0.015 
                } 
              : DEFAULT_REGION
          }
          showsUserLocation={permissionGranted}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {visibleSpots.map((spot) => (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
              onPress={() => handleOpenDirections(spot)}
            >
              <View style={[styles.customMarker, { backgroundColor: getMarkerColor(spot.spot_type) }]}>
                <Text style={styles.markerEmoji}>{getMarkerEmoji(spot.spot_type)}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Floating Top Header & Filters bar */}
        <View style={styles.topBarWrapper}>
          
          {/* Header Band */}
          <View style={styles.topBar}>
            <View style={styles.brandBlock}>
              <Text numberOfLines={1} style={styles.brand}>
                {eventName || 'Événement'}
              </Text>
              <Text style={styles.brandSubtitle}>Carte de l'Événement Partenaire</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Map Filters Horizontal Row */}
          {mapFilters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersContent}
            >
              {mapFilters.map((filter) => {
                const isSelected = selectedFilterKeys.includes(filter.key);
                return (
                  <TouchableOpacity
                    key={filter.id}
                    onPress={() => handleFilterToggle(filter.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.filterBadge,
                      {
                        backgroundColor: isSelected ? '#BE123C' : '#FFFFFF',
                        borderColor: isSelected ? '#BE123C' : '#E5E7EB',
                      }
                    ]}
                  >
                    <Ionicons 
                      name={filter.icon as any || 'location-outline'} 
                      size={14} 
                      color={isSelected ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text 
                      style={[
                        styles.filterText,
                        { color: isSelected ? '#FFFFFF' : '#4B5563' }
                      ]}
                    >
                      {filter.label || filter.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Floating Location Control Button */}
        <View style={styles.locationControlWrapper}>
          <LocationButton
            onPress={centerOnUser}
            heading={heading}
            disabled={!permissionGranted || loadingLocation}
          />
        </View>

      </View>
    </View>
  );
}
