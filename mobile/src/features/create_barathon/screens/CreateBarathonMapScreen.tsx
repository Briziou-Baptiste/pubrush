import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  MapPressEvent,
  Marker,
  Polyline,
  Region,
} from 'react-native-maps';

import LocationButton from '../../home/components/LocationButton';
import { useUserLocation } from '../../home/hooks/useUserLocation';
import { styles as homeStyles } from '../../home/styles/home.styles';
import { createBarathonMapStyles as styles } from '../styles/createBarathonMap.styles';
import { StopType } from '../types/createBarathon.types';

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

const WALKING_SPEED_KMH = 4.7;

export default function CreateBarathonMapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [hasCenteredInitially, setHasCenteredInitially] = useState(false);

  const params = useLocalSearchParams<{
    name?: string;
    startDateTimeIso?: string;
    travelTime?: string;
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

  const barathonName =
    typeof params.name === 'string' && params.name.trim()
      ? params.name
      : 'Nouveau barathon';

  const allowedTravelTimeMinutes = useMemo(() => {
    const raw =
      typeof params.travelTime === 'string' ? Number(params.travelTime) : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
  }, [params.travelTime]);

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

  const routeCoordinates = useMemo(
    () =>
      points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [points]
  );

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
  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setPendingPoint({ latitude, longitude });
    setPointName('');
    setSelectedStopType('bar');
    setModalVisible(true);
  }

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
        onPress={handleMapPress}
      >
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#22C55E"
            strokeWidth={4}
          />
        )}

        {points.map((p, index) => (
          <Marker
            key={p.id}
            coordinate={{
              latitude: p.latitude,
              longitude: p.longitude,
            }}
            title={`Étape ${index + 1} - ${p.name}`}
            description={`${p.latitude.toFixed(5)} / ${p.longitude.toFixed(5)}`}
          />
        ))}

        {pendingPoint && (
          <Marker coordinate={pendingPoint} title="Point sélectionné" />
        )}
      </MapView>

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
