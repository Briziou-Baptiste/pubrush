import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, {
  Circle,
  Marker,
  Polyline,
  Region,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import LocationButton from '../../home/components/LocationButton';
import { useUserLocation } from '../../home/hooks/useUserLocation';
import { styles as homeStyles } from '../../home/styles/home.styles';
import { createBarathonMapStyles as styles } from '../styles/createBarathonMap.styles';
import { StopType } from '../types/createBarathon.types';
import { fetchBarsSearch, fetchNearbyBars, fetchMapFilters } from '../../../lib/api';
import { getAccessToken } from '../../../lib/authStorage';

type SelectedPoint = {
  id: string;
  name: string;
  stopType: StopType;
  latitude: number;
  longitude: number;
};

const DEFAULT_REGION: Region = {
  latitude: 43.6047,
  longitude: 1.4442,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const WALKING_SPEED_KMH = 4.0;

export default function CreateBarathonMapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [hasCenteredInitially, setHasCenteredInitially] = useState(false);



  const params = useLocalSearchParams<{
    name?: string;
    startDateTimeIso?: string;
    travelTime?: string;
    maxTimeInBar?: string;
    initialStopsJson?: string;
    partnerEventId?: string;
    partnerEventName?: string;
  }>();

  const [points, setPoints] = useState<SelectedPoint[]>(() => {
    if (params.initialStopsJson) {
      try {
        const parsed = JSON.parse(params.initialStopsJson);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => ({
            id: s.id || `${Date.now()}-${Math.random()}`,
            name: s.name,
            stopType: s.stop_type || s.stopType || 'bar',
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
          }));
        }
      } catch (e) {
        console.error('[CreateMap] Failed to parse initialStopsJson:', e);
      }
    }
    return [];
  });
  const [pendingPoint, setPendingPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pointName, setPointName] = useState('');
  
  const [mapFilters, setMapFilters] = useState<any[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState<string>('bar');
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedStopType, setSelectedStopType] = useState<StopType>('bar');

  useEffect(() => {
    async function loadFilters() {
      try {
        setLoadingFilters(true);
        const token = await getAccessToken();
        if (!token) return;
        
        const eventId = params.partnerEventId ? Number(params.partnerEventId) : null;
        const filters = await fetchMapFilters(eventId, token);
        setMapFilters(filters);
        
        if (filters.length > 0) {
          const globalDefault = filters.find(f => f.is_global) || filters[0];
          setActiveFilterKey(globalDefault.key);
          setSelectedStopType(globalDefault.key);
        }
      } catch (err) {
        console.error('Failed to load map filters:', err);
      } finally {
        setLoadingFilters(false);
      }
    }
    loadFilters();
  }, [params.partnerEventId]);

  const { location, heading, permissionGranted, loadingLocation } =
    useUserLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);



  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const cleanText = searchQuery.trim();
    if (cleanText.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      void performSearch(cleanText);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, activeFilterKey]);

  function handleSearchChange(text: string) {
    setSearchQuery(text);
  }


  // Performs a text search for bars via the backend proxy
  async function performSearch(query: string) {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const searchLat = points.length > 0 ? points[points.length - 1].latitude : location?.latitude;
      const searchLon = points.length > 0 ? points[points.length - 1].longitude : location?.longitude;

      // Calls our backend API which in turn queries Photon/OSM with caching and SSL bypass
      const data = await fetchBarsSearch(
        query,
        searchLat,
        searchLon,
        token,
        activeFilterKey
      );

      const parsedResults = data.map((item: any) => ({
        name: item.name,
        street: item.street || '',
        city: item.city || '',
        country: item.country || '',
        latitude: item.latitude,
        longitude: item.longitude,
        stopType: item.stop_type as StopType,
      }));

      setSearchResults(parsedResults);
    } catch (error) {
      console.error('Failed to search bars via backend:', error);
    }
  }

  function handleSelectSearchResult(result: any) {
    setSearchQuery('');
    setSearchResults([]);

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
        zoom: 17,
      },
      { duration: 800 }
    );

    setPendingPoint({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setPointName(result.name);
    setSelectedStopType(result.stopType);
    setModalVisible(true);
  }

  const barathonName =
    typeof params.name === 'string' && params.name.trim()
      ? params.name
      : 'Nouveau barathon';

  const allowedTravelTimeMinutes = useMemo(() => {
    const raw =
      typeof params.travelTime === 'string' ? Number(params.travelTime) : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
  }, [params.travelTime]);

  useEffect(() => {
    let active = true;
    let didTimeout = false;

    // Set a client-side timeout of 12 seconds to prevent hanging the loader
    // in case of slow or blocked VPS/Overpass server responses
    const timeoutId = setTimeout(() => {
      if (active) {
        didTimeout = true;
        setLoadingSuggestions(false);
        console.warn('[suggestions] La requête suggestions a expiré (timeout client de 12s).');
      }
    }, 12000);

    async function loadSuggestions() {
      console.log('[loadSuggestions] points length:', points.length);
      if (points.length === 0) {
        setSuggestions([]);
        return;
      }

      const lastPoint = points[points.length - 1];
      console.log('[loadSuggestions] lastPoint:', lastPoint);

      try {
        setLoadingSuggestions(true);
        const token = await getAccessToken();
        console.log('[loadSuggestions] token fetched:', !!token, 'active:', active);
        if (!token) {
          Alert.alert("Debug Suggestions", "Erreur: token d'authentification manquant.");
          return;
        }
        if (!active) {
          console.log('[loadSuggestions] exited because active was false (cleanup ran)');
          return;
        }

        console.log('[loadSuggestions] calling fetchNearbyBars with filter:', activeFilterKey);
        const data = await fetchNearbyBars(
          lastPoint.latitude,
          lastPoint.longitude,
          allowedTravelTimeMinutes,
          token,
          activeFilterKey
        );
        console.log('[loadSuggestions] response received count:', data?.length);

        if (!data || data.length === 0) {
          Alert.alert("Debug Suggestions", "L'API a renvoyé 0 résultat (aucun lieu trouvé à proximité).");
        }

        // If the query took too long and already timed out, or if this effect was cleaned up, ignore results
        if (!active) {
          console.log('[loadSuggestions] exited after fetch because active was false');
          return;
        }
        if (didTimeout) {
          console.log('[loadSuggestions] exited after fetch because client timed out');
          return;
        }

        const filtered = (data || [])
          .map((item: any) => {
            const dist = typeof item.estimated_minutes === 'number'
              ? item.estimated_minutes
              : getEstimatedWalkingTimeMinutes(
                  lastPoint,
                  { latitude: item.latitude, longitude: item.longitude } as any
                );

            return {
              name: item.name || 'Lieu inconnu',
              street: item.street || '',
              city: item.city || '',
              country: item.country || '',
              latitude: item.latitude,
              longitude: item.longitude,
              stopType: (item.stop_type || 'bar') as StopType,
              estimatedMinutes: dist,
            };
          })
          .filter((item: any) => {
            // Strict travel time constraint check to prevent far outliers
            if (item.estimatedMinutes > allowedTravelTimeMinutes) {
              return false;
            }

            // Robust normalize function handling potentially missing or malformed names safely
            const normalize = (str: any) => {
              if (typeof str !== 'string') return '';
              return str
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // remove accents
                .replace(/^(le|la|les|the|l')\s+/, "") // remove articles
                .trim();
            };

            const normalizedItemName = normalize(item.name);

            // Avoid duplicate points
            return !points.some((p) => {
              const normalizedPointName = normalize(p.name);
              const isSameName = normalizedPointName.includes(normalizedItemName) || normalizedItemName.includes(normalizedPointName);
              const isSameCoords =
                Math.abs(Number(p.latitude) - Number(item.latitude)) < 0.0005 &&
                Math.abs(Number(p.longitude) - Number(item.longitude)) < 0.0005;

              return isSameName || isSameCoords;
            });
          })
          .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)
          .slice(0, 50);

        console.log('[loadSuggestions] setting suggestions count:', filtered.length);

        if (data && data.length > 0 && filtered.length === 0) {
          Alert.alert("Debug Suggestions", `L'API a renvoyé ${data.length} lieux à proximité, mais ils ont tous été filtrés comme doublons par rapport aux étapes existantes.`);
        }

        setSuggestions(filtered);
      } catch (error: any) {
        console.error('Failed to load suggestions:', error);
        Alert.alert("Debug Suggestions (Erreur)", `Erreur lors de la requête: ${error?.message || String(error)}`);
      } finally {
        clearTimeout(timeoutId);
        if (active && !didTimeout) {
          setLoadingSuggestions(false);
        }
      }
    }

    // Synchronously clear suggestions immediately when points change to prevent stale rendering state
    // and eliminate dynamic native MapKit subview index-shifting crashes
    setSuggestions([]);
    void loadSuggestions();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [points, allowedTravelTimeMinutes, activeFilterKey]);

  function handleAddSuggestedPoint(item: any) {
    setPoints((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: item.name,
        stopType: item.stopType,
        latitude: item.latitude,
        longitude: item.longitude,
      },
    ]);

    mapRef.current?.animateCamera(
      {
        center: { latitude: item.latitude, longitude: item.longitude },
        zoom: 17,
      },
      { duration: 800 }
    );
  }

  function handleConfirmAddSuggestedPoint(item: any) {
    const venueType = item.stopType === 'bar' ? 'le bar' : 'le restaurant';
    Alert.alert(
      "Ajouter l'étape",
      `Veux-tu ajouter ${venueType} "${item.name}" comme étape (${item.estimatedMinutes} min de marche) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Ajouter",
          style: "default",
          onPress: () => handleAddSuggestedPoint(item),
        },
      ]
    );
  }


  const startDateTime = useMemo(() => {
    if (!params.startDateTimeIso) return null;
    const d = new Date(params.startDateTimeIso);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [params.startDateTimeIso]);

  const dateLabel = startDateTime
    ? startDateTime.toLocaleDateString('fr-FR')
    : '--/--/----';

  const timeLabel = startDateTime
    ? startDateTime.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  const initialRegion = useMemo(() => {
    if (!location) return DEFAULT_REGION;

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [location]);



  useEffect(() => {
    if (!location || hasCenteredInitially || !mapRef.current) return;

    mapRef.current.animateCamera(
      {
        center: location,
        zoom: 16,
      },
      { duration: 800 }
    );

    setHasCenteredInitially(true);
  }, [location, hasCenteredInitially]);
    const cannotCreateBarathon = points.length < 2;


  function closeModal() {
    setModalVisible(false);
    setPendingPoint(null);
    setPointName('');
    setSelectedStopType('bar');
  }

  function confirmAddPoint() {
    if (!pendingPoint || !pointName.trim()) return;

    setPoints((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: pointName.trim(),
        stopType: selectedStopType,
        latitude: pendingPoint.latitude,
        longitude: pendingPoint.longitude,
      },
    ]);

    closeModal();
  }

  function removePoint(id: string) {
    setPoints((prev) => prev.filter((p) => p.id !== id));
  }

  function centerOnUser() {
    if (!location) return;

    mapRef.current?.animateCamera(
      {
        center: location,
        zoom: 17,
      },
      { duration: 600 }
    );
  }

  function toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  function getDistanceInKm(from: SelectedPoint, to: SelectedPoint) {
    const earthRadiusKm = 6371;

    const dLat = toRadians(to.latitude - from.latitude);
    const dLon = toRadians(to.longitude - from.longitude);

    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) *
        Math.sin(dLon / 2) *
        Math.cos(lat1) *
        Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  function getEstimatedWalkingTimeMinutes(from: SelectedPoint, to: SelectedPoint) {
    const distanceKm = getDistanceInKm(from, to);
    const timeHours = distanceKm / WALKING_SPEED_KMH;
    return Math.max(1, Math.round(timeHours * 60));
  }

  function getTravelTimeTone(estimatedMinutes: number) {
    if (estimatedMinutes > allowedTravelTimeMinutes) {
      return { color: '#EF4444' };
    }

    if (estimatedMinutes >= allowedTravelTimeMinutes - 2) {
      return { color: '#F59E0B' };
    }

    return { color: '#22C55E' };
  }

  const allPolylines = useMemo(() => {
    return points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const key = `polyline-${point.id}-${nextPoint.id}`;

      const lat1 = Number(point.latitude);
      const lng1 = Number(point.longitude);
      const lat2 = Number(nextPoint.latitude);
      const lng2 = Number(nextPoint.longitude);

      if (Number.isNaN(lat1) || Number.isNaN(lng1) || Number.isNaN(lat2) || Number.isNaN(lng2)) {
        return null;
      }

      return (
        <Polyline
          key={key}
          coordinates={[
            { latitude: lat1, longitude: lng1 },
            { latitude: lat2, longitude: lng2 },
          ]}
          strokeColor="#22C55E" // Solid direct green line, 100% native
          strokeWidth={4}
        />
      );
    }).filter(Boolean);
  }, [points]);

  const getStopTypeLabel = (typeKey: string) => {
    const filter = mapFilters.find((f) => f.key === typeKey);
    if (filter) {
      let emoji = '📍';
      if (filter.icon === 'beer') emoji = '🍻';
      else if (filter.icon === 'restaurant') emoji = '🍔';
      else if (filter.icon === 'medical') emoji = '🏥';
      else if (filter.icon === 'flag') emoji = '🚩';
      else if (filter.icon === 'pizza') emoji = '🍕';
      return `${emoji} ${filter.label}`;
    }
    if (typeKey === 'bar') return '🍻 Bar';
    if (typeKey === 'food') return '🍔 Restaurant';
    return `📍 ${typeKey}`;
  };

  const allMarkers = useMemo(() => {
    const list: React.ReactElement[] = [];

    // 1. Confirmed step markers (Red)
    points.forEach((p, index) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        list.push(
          <Marker
            key={`step-marker-${p.id}`}
            coordinate={{ latitude: lat, longitude: lng }}
            pinColor="red" // Explicitly red, 100% iOS/Android compatible under Fabric
            title={`Étape ${index + 1} - ${p.name}`}
            description={`${getStopTypeLabel(p.stopType)} • ${lat.toFixed(5)} / ${lng.toFixed(5)}`}
          />
        );
      }
    });

    // 2. Pending selection marker (Green)
    if (pendingPoint) {
      const lat = Number(pendingPoint.latitude);
      const lng = Number(pendingPoint.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        list.push(
          <Marker
            key="pending-point-marker"
            coordinate={{ latitude: lat, longitude: lng }}
            pinColor="green" // Explicitly green, 100% iOS/Android compatible under Fabric
            title="Point sélectionné"
          />
        );
      }
    }

    // 3. Suggestions markers (Purple) - Only display if we have at least one point
    if (points.length > 0) {
      suggestions.forEach((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          list.push(
            <Marker
              key={`suggestion-marker-${item.name}-${lat}-${lng}`}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor="purple" // Explicitly purple, 100% iOS/Android compatible under Fabric
              title={item.name}
              description={`🚶 ${item.estimatedMinutes} min • ${getStopTypeLabel(item.stopType)} • Appuyer pour ajouter`}
              onCalloutPress={() => handleConfirmAddSuggestedPoint(item)}
            />
          );
        }
      });
    }

    return list;
  }, [points, pendingPoint, suggestions, mapFilters]);

  return (
    <View style={homeStyles.safeArea}>
      <MapView
        ref={mapRef}
        style={homeStyles.map}
        initialRegion={initialRegion}
        showsUserLocation={permissionGranted}
        showsMyLocationButton={false}
        onPress={() => Keyboard.dismiss()}
      >
        {[
          ...(points.length > 0 ? [
            <Circle
              key="allowed-travel-radius"
              center={{
                latitude: Number(points[points.length - 1].latitude),
                longitude: Number(points[points.length - 1].longitude),
              }}
              // Radius calculation: 4 km/h = ~66.67 meters per minute
              radius={allowedTravelTimeMinutes * 66.67}
              fillColor="rgba(59, 130, 246, 0.15)"
              strokeColor="rgba(59, 130, 246, 0.4)"
              strokeWidth={2}
            />
          ] : []),
          ...allPolylines,
          ...allMarkers,
        ]}
      </MapView>

      {/* Floating suggestions loading loader */}
      {loadingSuggestions && (
        <View style={{
          position: 'absolute',
          top: 180,
          alignSelf: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 20,
          paddingVertical: 8,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
          zIndex: 999,
        }}>
          <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 13, color: '#1F2937', fontWeight: '700' }}>
            Recherche en cours...
          </Text>
        </View>
      )}

      <View style={homeStyles.topBarWrapper}>
        <View style={homeStyles.topBar}>
          <View style={homeStyles.brandBlock}>
            <Text style={homeStyles.brand}>PubRush</Text>
            <Text style={homeStyles.brandSubtitle}>
              Nom du barathon : {barathonName}
            </Text>
            <Text style={styles.metaText}>
              Date de début : {dateLabel} à {timeLabel}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        {/* Barre de Recherche de Bars */}
        <View style={{
          marginTop: 10,
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.8)',
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
          padding: 4,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
          }}>
            <Ionicons name="search" size={18} color="#8A8A8A" />
            <TextInput
              placeholder="Rechercher un lieu (ex: Delirium...)"
              placeholderTextColor="#8A8A8A"
              value={searchQuery}
              onChangeText={handleSearchChange}
              style={{
                flex: 1,
                paddingLeft: 8,
                paddingVertical: 10,
                fontSize: 14,
                color: '#111827',
              }}
            />
          </View>

          {mapFilters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 8,
              }}
            >
              {mapFilters.map((filter) => {
                const isActive = activeFilterKey === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.id}
                    onPress={() => {
                      setActiveFilterKey(filter.key);
                      setSelectedStopType(filter.key);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isActive ? '#3B82F6' : '#F3F4F6',
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: isActive ? '#3B82F6' : '#E5E7EB',
                      shadowColor: '#000',
                      shadowOpacity: isActive ? 0.15 : 0.02,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={filter.icon as any}
                      size={14}
                      color={isActive ? '#FFFFFF' : '#4B5563'}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isActive ? '#FFFFFF' : '#4B5563',
                      }}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {searchResults.length > 0 && (
            <ScrollView
              style={{
                maxHeight: 180,
                borderTopWidth: 1,
                borderTopColor: '#E5E7EB',
                marginTop: 4,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((result, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: idx === searchResults.length - 1 ? 0 : 1,
                    borderBottomColor: '#F3F4F6',
                  }}
                  onPress={() => handleSelectSearchResult(result)}
                >
                  <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>
                    {result.name}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                    {result.city ? `${result.city}, ` : ''}{result.country || ''} • {result.stopType === 'bar' ? '🍻 Bar' : '🍔 Resto'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={homeStyles.locationControlWrapper}>
        <LocationButton
          onPress={centerOnUser}
          heading={heading}
          disabled={!permissionGranted || loadingLocation}
        />
      </View>



      <View style={styles.bottomSheet}>
        <Text style={styles.sheetTitle}>Lieux sélectionnés</Text>

        <ScrollView
          style={styles.pointsList}
          contentContainerStyle={styles.pointsListContent}
          showsVerticalScrollIndicator={false}
        >
          {points.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucun lieu sélectionné</Text>
              <Text style={styles.emptySubtitle}>
                Appuie sur la carte pour ajouter un lieu.
              </Text>
            </View>
          ) : (
            points.map((point, index) => {
              const nextPoint = points[index + 1];
              const estimatedMinutes = nextPoint
                ? getEstimatedWalkingTimeMinutes(point, nextPoint)
                : null;

              const tone = estimatedMinutes
                ? getTravelTimeTone(estimatedMinutes)
                : null;

              return (
                <View key={point.id}>
                  <View style={styles.pointCard}>
                    <View style={styles.pointCardHeader}>
                      <Text style={styles.pointIndex}>Étape {index + 1}</Text>

                      <TouchableOpacity onPress={() => removePoint(point.id)}>
                        <Text style={styles.removeText}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.pointName}>{point.name}</Text>
                    <Text style={styles.pointType}>
                      {point.stopType === 'bar' ? 'Bar' : 'Restaurant'}
                    </Text>
                    <Text style={styles.pointCoords}>
                      {point.latitude.toFixed(5)} / {point.longitude.toFixed(5)}
                    </Text>
                  </View>

                  {nextPoint && estimatedMinutes && tone ? (
                    <View style={styles.travelBlock}>
                      <Text style={styles.travelArrow}>↓</Text>

                      <View style={styles.travelTextWrapper}>
                        <Text style={styles.travelLine}>
                          <Text style={styles.travelLabel}>Temps estimé : </Text>
                          <Text style={[styles.travelValue, { color: tone.color }]}>
                            {estimatedMinutes} min
                          </Text>
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>

          <TouchableOpacity
            style={[
              styles.createButton,
              cannotCreateBarathon && styles.createButtonDisabled,
            ]}
            disabled={cannotCreateBarathon}
            onPress={() => {
              if (cannotCreateBarathon) return;

              router.push({
                pathname: '/create-barathon-recap',
                params: {
                  name: barathonName,
                  startDateTimeIso: params.startDateTimeIso,
                  maxTimeInBar: params.maxTimeInBar,
                  travelTime: params.travelTime,
                  stopsJson: JSON.stringify(points),
                  partnerEventId: params.partnerEventId || '',
                },
              });
            }}
          >
            <Text style={styles.createButtonText}>Créer mon barathon</Text>
          </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Ajouter ce lieu au barathon ?
              </Text>

              {pendingPoint && (
                <Text style={styles.modalCoords}>
                  {pendingPoint.latitude.toFixed(6)} /{' '}
                  {pendingPoint.longitude.toFixed(6)}
                </Text>
              )}

              <TextInput
                value={pointName}
                onChangeText={setPointName}
                placeholder="Nom du lieu"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
              />

              <View style={[styles.stopTypeSelector, { flexWrap: 'wrap', gap: 6, justifyContent: 'center' }]}>
                {mapFilters.map((filter) => {
                  const isSelected = selectedStopType === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.id}
                      onPress={() => setSelectedStopType(filter.key)}
                      style={[
                        styles.stopTypeButton,
                        { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 2, marginBottom: 4 },
                        isSelected && styles.stopTypeButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stopTypeButtonText,
                          isSelected && styles.stopTypeButtonTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Non</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmAddPoint}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmButtonText}>Oui</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
