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
import {
  fetchWalkingRoute,
  fetchWalkingRoutesInParallel,
  RouteSegment,
  getRouteMidpoint,
  optimizeStopOrder,
  getStraightLineWalkingMinutes,
} from '../services/routing.service';

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

const WALKING_SPEED_KMH = 4.8;

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
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null);
  
  const [mapFilters, setMapFilters] = useState<any[]>([]);
  const [activeFilterKey, setActiveFilterKey] = useState<string>('bar');
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedStopType, setSelectedStopType] = useState<StopType>('bar');
  const [routeSegments, setRouteSegments] = useState<Record<string, RouteSegment>>({});
  const [isRouteListCollapsed, setIsRouteListCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAllRouteSegments() {
      if (points.length < 2) {
        setRouteSegments({});
        return;
      }

      try {
        const updated = await fetchWalkingRoutesInParallel(points, routeSegments);
        if (active) {
          setRouteSegments(updated);
        }
      } catch (err) {
        console.error('[CreateMap] Failed to load routes in parallel:', err);
      }
    }

    void loadAllRouteSegments();

    return () => {
      active = false;
    };
  }, [points]);

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
          console.warn('[loadSuggestions] Missing auth token.');
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
          console.log('[loadSuggestions] 0 venues returned.');
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
        setSuggestions(filtered);
      } catch (error: any) {
        console.warn('[loadSuggestions] Failed to load suggestions:', error);
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
    setSelectedSuggestion(null);

    mapRef.current?.animateCamera(
      {
        center: { latitude: item.latitude, longitude: item.longitude },
        zoom: 17,
      },
      { duration: 800 }
    );
  }

  function handleAutoGenerate() {
    if (suggestions.length === 0) {
      Alert.alert(
        'Génération automatique',
        'Aucun bar disponible dans ce rayon. Sélectionnez un premier bar ou augmentez le temps de marche maximal.'
      );
      return;
    }

    const candidates = suggestions.slice(0, 4);
    if (candidates.length < 2) {
      Alert.alert(
        'Génération automatique',
        'Il faut au moins 2 bars disponibles à proximité pour composer un parcours.'
      );
      return;
    }

    const baseStops: SelectedPoint[] = points.length > 0 ? [points[0]] : [];
    const needed = Math.max(2, 4 - baseStops.length);

    const newAdditions: SelectedPoint[] = candidates.slice(0, needed).map((c) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: c.name,
      stopType: c.stopType,
      latitude: c.latitude,
      longitude: c.longitude,
    }));

    const combined = [...baseStops, ...newAdditions];
    const optimized = optimizeStopOrder(combined);
    setPoints(optimized);
    setSelectedSuggestion(null);

    Alert.alert(
      'Parcours généré !',
      `PubRush a composé un barathon de ${optimized.length} étapes optimisées pour minimiser votre marche.`
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

  function movePointUp(index: number) {
    if (index <= 0) return;
    setPoints((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  function movePointDown(index: number) {
    if (index >= points.length - 1) return;
    setPoints((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  function handleOptimizeRoute() {
    if (points.length <= 2) return;
    const optimized = optimizeStopOrder(points);
    setPoints(optimized);
    Alert.alert(
      'Parcours optimisé',
      'L’ordre des étapes a été réorganisé pour minimiser le temps de marche total entre les bars !'
    );
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
    const key = `${from.id}->${to.id}`;
    if (routeSegments[key]?.durationMinutes) {
      return routeSegments[key].durationMinutes;
    }
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
    if (points.length < 2) return [];

    const elements: React.ReactElement[] = [];

    points.slice(0, -1).forEach((point, index) => {
      const nextPoint = points[index + 1];
      const segmentKey = `${point.id}->${nextPoint.id}`;
      const segment = routeSegments[segmentKey];

      const lat1 = Number(point.latitude);
      const lng1 = Number(point.longitude);
      const lat2 = Number(nextPoint.latitude);
      const lng2 = Number(nextPoint.longitude);

      if (Number.isNaN(lat1) || Number.isNaN(lng1) || Number.isNaN(lat2) || Number.isNaN(lng2)) {
        return;
      }

      const coords =
        segment?.coordinates && segment.coordinates.length >= 2
          ? segment.coordinates
          : [
              { latitude: lat1, longitude: lng1 },
              { latitude: lat2, longitude: lng2 },
            ];

      // 1. Glow halo behind the route
      elements.push(
        <Polyline
          key={`glow-${segmentKey}`}
          coordinates={coords}
          strokeColor="rgba(16, 185, 129, 0.25)"
          strokeWidth={8}
        />
      );

      // 2. High-contrast street pedestrian route
      elements.push(
        <Polyline
          key={`route-${segmentKey}`}
          coordinates={coords}
          strokeColor="#10B981"
          strokeWidth={4}
        />
      );

      // 3. Midpoint floating badge with real minutes & meters
      const midpoint = getRouteMidpoint(coords);
      if (midpoint && segment) {
        const distLabel =
          segment.distanceMeters >= 1000
            ? `${(segment.distanceMeters / 1000).toFixed(1)} km`
            : `${segment.distanceMeters} m`;

        elements.push(
          <Marker
            key={`badge-${segmentKey}`}
            coordinate={midpoint}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.92)',
                borderColor: '#10B981',
                borderWidth: 1.5,
                borderRadius: 14,
                paddingHorizontal: 8,
                paddingVertical: 3,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="walk" size={10} color="#94A3B8" />
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                  {segment.durationMinutes} min • {distLabel}
                </Text>
              </View>
            </View>
          </Marker>
        );
      }
    });

    return elements;
  }, [points, routeSegments]);

  const getStopTypeLabel = (typeKey: string) => {
    const filter = mapFilters.find((f) => f.key === typeKey);
    if (filter) return filter.label;
    if (typeKey === 'bar') return 'Bar';
    if (typeKey === 'food') return 'Restaurant';
    return typeKey;
  };

  const allMarkers = useMemo(() => {
    const list: React.ReactElement[] = [];

    // 1. Confirmed step markers (Numbered modern badges)
    points.forEach((p, index) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const isBar = p.stopType === 'bar';
        const pinBgColor = isBar ? '#D97706' : '#DC2626';

        list.push(
          <Marker
            key={`step-marker-${p.id}`}
            coordinate={{ latitude: lat, longitude: lng }}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={false}
            title={`Étape ${index + 1} - ${p.name}`}
            description={`${isBar ? 'Bar' : 'Restaurant'} • Étape confirmée`}
          >
            <View style={styles.customStepMarker}>
              <View style={[styles.stepPinBubble, { backgroundColor: pinBgColor }]}>
                <Text style={styles.stepPinNumber}>{index + 1}</Text>
                <Ionicons name={isBar ? 'beer' : 'restaurant'} size={12} color="#FFFFFF" />
              </View>
              <View style={[styles.stepPinTail, { borderTopColor: pinBgColor }]} />
            </View>
          </Marker>
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
            pinColor="green"
            title="Point sélectionné"
            description="Toucher pour configurer l'étape"
          />
        );
      }
    }

    // 3. Suggestions markers (Yellow for Bars, Purple for Restaurants)
    if (points.length > 0) {
      suggestions.forEach((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const isBar = item.stopType === 'bar';
          list.push(
            <Marker
              key={`suggestion-marker-${item.name}-${lat}-${lng}`}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={isBar ? 'yellow' : 'purple'}
              title={`${item.name} (${isBar ? 'Bar' : 'Restaurant'})`}
              description={`${item.estimatedMinutes} min de marche • Toucher pour afficher`}
              onPress={() => setSelectedSuggestion(item)}
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
              // Radius calculation: 4.8 km/h = 80 meters per minute
              radius={allowedTravelTimeMinutes * 80}
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
            <View style={styles.stepperHeader}>
              <View style={[styles.stepperBarMini, styles.stepperBarMiniActive]} />
              <View style={[styles.stepperBarMini, styles.stepperBarMiniActive]} />
              <View style={styles.stepperBarMini} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginBottom: 2 }}>
              ÉTAPE 2 SUR 3 • CHOIX DES LIEUX
            </Text>
            <Text style={homeStyles.brand}>{barathonName}</Text>
            <Text style={styles.metaText}>
              {dateLabel} à {timeLabel} • Max {allowedTravelTimeMinutes}m de marche / étape
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
          >
            <Ionicons name="arrow-back" size={14} color="#FFFFFF" />
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
              {searchResults.map((result, idx) => {
                const isBar = result.stopType === 'bar';
                return (
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14, flex: 1 }}>
                        {result.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: isBar ? '#FEF3C7' : '#FEE2E2',
                          borderColor: isBar ? '#FCD34D' : '#FCA5A5',
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 2.5,
                        }}
                      >
                        <Ionicons
                          name={isBar ? 'beer' : 'restaurant'}
                          size={11}
                          color={isBar ? '#92400E' : '#991B1B'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isBar ? '#92400E' : '#991B1B',
                          }}
                        >
                          {isBar ? 'Bar' : 'Restaurant'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
                      {result.city ? `${result.city}, ` : ''}{result.country || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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



      {/* Floating Suggestion Preview Card */}
      {selectedSuggestion && (
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionCardTop}>
            <Text style={styles.suggestionCardTitle} numberOfLines={1}>
              {selectedSuggestion.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: selectedSuggestion.stopType === 'bar' ? '#FEF3C7' : '#FEE2E2',
                borderColor: selectedSuggestion.stopType === 'bar' ? '#FCD34D' : '#FCA5A5',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2.5,
              }}
            >
              <Ionicons
                name={selectedSuggestion.stopType === 'bar' ? 'beer' : 'restaurant'}
                size={11}
                color={selectedSuggestion.stopType === 'bar' ? '#92400E' : '#991B1B'}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: selectedSuggestion.stopType === 'bar' ? '#92400E' : '#991B1B',
                }}
              >
                {selectedSuggestion.stopType === 'bar' ? 'Bar' : 'Restaurant'}
              </Text>
            </View>
          </View>

          <Text style={styles.suggestionCardSub}>
            À {selectedSuggestion.estimatedMinutes} min de marche du bar précédent
            {selectedSuggestion.city ? ` • ${selectedSuggestion.city}` : ''}
          </Text>

          <View style={styles.suggestionCardActions}>
            <TouchableOpacity
              style={styles.suggestionAddBtn}
              onPress={() => handleAddSuggestedPoint(selectedSuggestion)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.suggestionAddBtnText}>Ajouter au parcours</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionDismissBtn}
              onPress={() => setSelectedSuggestion(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.suggestionDismissBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.bottomSheet, isRouteListCollapsed && { maxHeight: 130, paddingBottom: 10 }]}>
        <TouchableOpacity
          style={styles.sheetHeader}
          activeOpacity={0.75}
          onPress={() => setIsRouteListCollapsed((prev) => !prev)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Ionicons
              name={isRouteListCollapsed ? 'chevron-up-circle' : 'chevron-down-circle'}
              size={18}
              color="#2563EB"
            />
            <Text style={[styles.sheetTitle, { marginBottom: 0 }]} numberOfLines={1}>
              {isRouteListCollapsed
                ? `Parcours (${points.length}) • Déplier`
                : `Lieux sélectionnés (${points.length})`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {points.length <= 1 && suggestions.length >= 2 && (
              <TouchableOpacity
                style={styles.magicButton}
                onPress={handleAutoGenerate}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.magicButtonText}>🪄 Auto (4 bars)</Text>
              </TouchableOpacity>
            )}
            {points.length >= 3 && (
              <TouchableOpacity
                style={styles.optimizeButton}
                onPress={handleOptimizeRoute}
              >
                <Ionicons name="flash" size={12} color="#B45309" />
                <Text style={styles.optimizeButtonText}>Optimiser</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {!isRouteListCollapsed && (
          <ScrollView
            style={styles.pointsList}
            contentContainerStyle={styles.pointsListContent}
            showsVerticalScrollIndicator={false}
          >
          {points.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucun lieu sélectionné</Text>
              <Text style={styles.emptySubtitle}>
                Appuie sur la carte pour ajouter un lieu ou utilise la recherche ci-dessus.
              </Text>
            </View>
          ) : (
            points.map((point, index) => {
              const nextPoint = points[index + 1];
              const segmentKey = nextPoint ? `${point.id}->${nextPoint.id}` : null;
              const segment = segmentKey ? routeSegments[segmentKey] : null;

              const estimatedMinutes = nextPoint
                ? (segment?.durationMinutes || getEstimatedWalkingTimeMinutes(point, nextPoint))
                : null;

              const tone = estimatedMinutes
                ? getTravelTimeTone(estimatedMinutes)
                : null;

              const distanceLabel = segment?.distanceMeters
                ? (segment.distanceMeters >= 1000
                    ? ` • ${(segment.distanceMeters / 1000).toFixed(1)} km`
                    : ` • ${segment.distanceMeters} m`)
                : '';

              return (
                <View key={point.id}>
                  <View style={styles.pointCard}>
                    <View style={styles.pointCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.pointIndex}>Étape {index + 1}</Text>
                        <View style={styles.stepOrderControls}>
                          <TouchableOpacity
                            onPress={() => movePointUp(index)}
                            disabled={index === 0}
                            style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                          >
                            <Ionicons
                              name="chevron-up"
                              size={14}
                              color={index === 0 ? '#9CA3AF' : '#111827'}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => movePointDown(index)}
                            disabled={index === points.length - 1}
                            style={[
                              styles.orderButton,
                              index === points.length - 1 && styles.orderButtonDisabled,
                            ]}
                          >
                            <Ionicons
                              name="chevron-down"
                              size={14}
                              color={index === points.length - 1 ? '#9CA3AF' : '#111827'}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity onPress={() => removePoint(point.id)}>
                        <Text style={styles.removeText}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                      <Text style={[styles.pointName, { flex: 1, marginTop: 0 }]}>{point.name}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: point.stopType === 'bar' ? '#FEF3C7' : '#FEE2E2',
                          borderColor: point.stopType === 'bar' ? '#FCD34D' : '#FCA5A5',
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Ionicons
                          name={point.stopType === 'bar' ? 'beer' : 'restaurant'}
                          size={12}
                          color={point.stopType === 'bar' ? '#92400E' : '#991B1B'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: point.stopType === 'bar' ? '#92400E' : '#991B1B',
                          }}
                        >
                          {point.stopType === 'bar' ? 'Bar' : 'Restaurant'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.pointCoords}>
                      {point.latitude.toFixed(5)} / {point.longitude.toFixed(5)}
                    </Text>
                  </View>

                  {nextPoint && estimatedMinutes && tone ? (
                    <View style={styles.travelBlock}>
                      <Text style={styles.travelArrow}>↓</Text>

                      <View style={styles.travelTextWrapper}>
                        <Text style={styles.travelLine}>
                          <Text style={styles.travelLabel}>Temps de marche réel : </Text>
                          <Text style={[styles.travelValue, { color: tone.color }]}>
                            {estimatedMinutes} min{distanceLabel}
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
        )}

        {cannotCreateBarathon && !isRouteListCollapsed && (
          <View style={styles.guidanceCard}>
            <Ionicons name="information-circle" size={15} color="#2563EB" />
            <Text style={styles.guidanceText}>
              Ajoutez au moins 2 lieux pour calculer le trajet piéton et continuer.
            </Text>
          </View>
        )}

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.createButtonText}>Valider mon parcours</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
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
              <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>
                Précisez le type d'établissement pour l'intégrer au barathon.
              </Text>

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
