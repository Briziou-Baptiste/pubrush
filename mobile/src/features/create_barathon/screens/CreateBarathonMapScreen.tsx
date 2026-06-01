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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, {
  Circle,
  Marker,
  Polyline,
  Region,
} from 'react-native-maps';

import LocationButton from '../../home/components/LocationButton';
import { useUserLocation } from '../../home/hooks/useUserLocation';
import { styles as homeStyles } from '../../home/styles/home.styles';
import { createBarathonMapStyles as styles } from '../styles/createBarathonMap.styles';
import { StopType } from '../types/createBarathon.types';
import { fetchBarsSearch, fetchNearbyBars } from '../../../lib/api';
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

  const [routeGeometries, setRouteGeometries] = useState<
    Record<string, { latitude: number; longitude: number }[]>
  >({});

  const params = useLocalSearchParams<{
    name?: string;
    startDateTimeIso?: string;
    travelTime?: string;
    maxTimeInBar?: string;
  }>();

  const [points, setPoints] = useState<SelectedPoint[]>([]);
  const [pendingPoint, setPendingPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pointName, setPointName] = useState('');
const [selectedStopType, setSelectedStopType] = useState<StopType>('bar');

  const { location, heading, permissionGranted, loadingLocation } =
    useUserLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);



  function handleSearchChange(text: string) {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const cleanText = text.trim();
    if (cleanText.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      void performSearch(cleanText);
    }, 300);
  }

  // Performs a text search for bars via the backend proxy
  async function performSearch(query: string) {
    try {
      const token = await getAccessToken();
      if (!token) return;

      // Calls our backend API which in turn queries Photon/OSM with caching and SSL bypass
      const data = await fetchBarsSearch(
        query,
        location?.latitude,
        location?.longitude,
        token
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
    void loadSuggestions();
  }, [points, allowedTravelTimeMinutes]);

  // Loads nearby bar suggestions based on the last added point
  async function loadSuggestions() {
    if (points.length === 0) {
      setSuggestions([]);
      return;
    }

    const lastPoint = points[points.length - 1];

    try {
      setLoadingSuggestions(true);
      const token = await getAccessToken();
      if (!token) return;

      // Calls our backend API which queries Overpass/OSM for bars around the given location
      const data = await fetchNearbyBars(
        lastPoint.latitude,
        lastPoint.longitude,
        allowedTravelTimeMinutes,
        token
      );


      const filtered = data
        .map((item: any) => {
          const dist = typeof item.estimated_minutes === 'number'
            ? item.estimated_minutes
            : getEstimatedWalkingTimeMinutes(
                lastPoint,
                { latitude: item.latitude, longitude: item.longitude } as any
              );

          return {
            name: item.name,
            street: item.street || '',
            city: item.city || '',
            country: item.country || '',
            latitude: item.latitude,
            longitude: item.longitude,
            stopType: item.stop_type as StopType,
            estimatedMinutes: dist,
          };
        })
        .filter((item: any) => {
          // Strict travel time constraint check to prevent far outliers
          if (item.estimatedMinutes > allowedTravelTimeMinutes) {
            return false;
          }
          // Avoid duplicate points
          return !points.some(
            (p) =>
              p.name.toLowerCase() === item.name.toLowerCase() ||
              (Math.abs(p.latitude - item.latitude) < 0.0001 &&
                Math.abs(p.longitude - item.longitude) < 0.0001)
          );
        })
        .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)
        .slice(0, 15);

      setSuggestions(filtered);
    } catch (error) {
      console.error('[suggestions] Erreur lors du chargement des suggestions :', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }

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

  useEffect(() => {
    void loadRouteGeometries();
  }, [points]);

  // Fetches walking directions from OSRM between consecutive points
  async function loadRouteGeometries() {
    if (points.length < 2) {
      setRouteGeometries({});
      return;
    }

    const newGeometries = { ...routeGeometries };
    let hasNewChange = false;

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const key = `${from.id}-${to.id}`;

      if (!newGeometries[key]) {
        try {
          const url = `https://router.project-osrm.org/route/v1/foot/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?geometries=geojson&overview=full`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(
              ([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              })
            );
            newGeometries[key] = coords;
            hasNewChange = true;
          }
        } catch (error) {
          console.error(`Failed to fetch OSRM route for ${key}:`, error);
        }
      }
    }

    if (hasNewChange) {
      setRouteGeometries(newGeometries);
    }
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

  return (
    <SafeAreaView style={homeStyles.safeArea}>
      <MapView
        ref={mapRef}
        style={homeStyles.map}
        initialRegion={initialRegion}
        showsUserLocation={permissionGranted}
        showsMyLocationButton={false}
      >
        {/* Draw a radius circle around the last point indicating the allowed travel distance */}
        {points.length > 0 && (
          <Circle
            key={`circle-${points.length}-${points[points.length - 1].id}`}
            center={{
              latitude: points[points.length - 1].latitude,
              longitude: points[points.length - 1].longitude,
            }}
            // Radius calculation: 4 km/h = ~66.67 meters per minute
            radius={allowedTravelTimeMinutes * 66.67}
            fillColor="rgba(59, 130, 246, 0.15)"
            strokeColor="rgba(59, 130, 246, 0.4)"
            strokeWidth={2}
          />
        )}

        {points.length > 0 && suggestions.map((item, idx) => (
          <Marker
            key={`suggestion-${points.length}-${item.name}-${item.latitude}-${item.longitude}`}
            coordinate={{
              latitude: item.latitude,
              longitude: item.longitude,
            }}
            pinColor="blue"
            title={item.name}
            description={`🚶 ${item.estimatedMinutes} min • ${item.stopType === 'bar' ? '🍻 Bar' : '🍔 Restaurant'} • Appuyer pour ajouter`}
            onCalloutPress={() => handleConfirmAddSuggestedPoint(item)}
          />
        ))}

        {points.map((point, index) => {
          const nextPoint = points[index + 1];
          if (!nextPoint) return null;
          const key = `${point.id}-${nextPoint.id}`;
          const path = routeGeometries[key];
          if (path && path.length > 0) {
            return (
              <Polyline
                key={key}
                coordinates={path}
                strokeColor="#22C55E"
                strokeWidth={4}
              />
            );
          } else {
            // Smooth gray dashed fallback line while OSRM streets are loading
            return (
              <Polyline
                key={key}
                coordinates={[
                  { latitude: point.latitude, longitude: point.longitude },
                  { latitude: nextPoint.latitude, longitude: nextPoint.longitude },
                ]}
                strokeColor="#9CA3AF"
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            );
          }
        })}

        {points.map((p, index) => (
          <Marker
            key={p.id}
            coordinate={{
              latitude: p.latitude,
              longitude: p.longitude,
            }}
            title={`Étape ${index + 1} - ${p.name}`}
            description={`${p.stopType === 'bar' ? '🍻 Bar' : '🍔 Restaurant'} • ${p.latitude.toFixed(5)} / ${p.longitude.toFixed(5)}`}
          />
        ))}

        {pendingPoint && (
          <Marker coordinate={pendingPoint} title="Point sélectionné" />
        )}
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
          <TextInput
            placeholder="🔍 Rechercher un bar (ex: Delirium...)"
            placeholderTextColor="#8A8A8A"
            value={searchQuery}
            onChangeText={handleSearchChange}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: '#111827',
            }}
          />

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

            <View style={styles.stopTypeSelector}>
              <TouchableOpacity
                onPress={() => setSelectedStopType('bar')}
                style={[
                  styles.stopTypeButton,
                  selectedStopType === 'bar' && styles.stopTypeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.stopTypeButtonText,
                    selectedStopType === 'bar' && styles.stopTypeButtonTextActive,
                  ]}
                >
                  Bar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedStopType('food')}
                style={[
                  styles.stopTypeButton,
                  styles.stopTypeButtonSpacing,
                  selectedStopType === 'food' && styles.stopTypeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.stopTypeButtonText,
                    selectedStopType === 'food' && styles.stopTypeButtonTextActive,
                  ]}
                >
                  Restaurant
                </Text>
              </TouchableOpacity>
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
      </Modal>
    </SafeAreaView>
  );
}
