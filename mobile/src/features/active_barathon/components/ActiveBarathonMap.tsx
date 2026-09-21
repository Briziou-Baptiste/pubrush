import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { ActiveBarathonStop, LatLng } from '../types/activeBarathon.types';
import { ParticipantLocation } from '../types/webSocker.types';
import { styles } from '../styles/activeBarathon.styles';
import { fetchWalkingRoutesInParallel, RouteSegment } from '../../create_barathon/services/routing.service';

type Props = {
  initialRegion: Region;
  currentLocation: LatLng | null;
  visitedPath: LatLng[];
  allStops: ActiveBarathonStop[];
  activeStopIndex: number;
  friendLocations?: ParticipantLocation[];
  currentUserId?: number;
};

export default function ActiveBarathonMap({
  initialRegion,
  currentLocation,
  visitedPath,
  allStops,
  activeStopIndex,
  friendLocations,
  currentUserId,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [routeSegments, setRouteSegments] = useState<Record<string, RouteSegment>>({});

  // Parallel OSRM route calculation with incremental caching
  useEffect(() => {
    let active = true;

    async function loadRoutes() {
      if (allStops.length < 2) {
        setRouteSegments({});
        return;
      }

      const points = allStops.map((s) => ({
        id: String(s.id),
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      }));

      try {
        const updated = await fetchWalkingRoutesInParallel(points, routeSegments);
        if (active) {
          setRouteSegments(updated);
        }
      } catch (err) {
        console.error('[ActiveBarathonMap] Error fetching parallel routes:', err);
      }
    }

    void loadRoutes();

    return () => {
      active = false;
    };
  }, [allStops]);

  function handleCenterOnMe() {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500
      );
    }
  }

  function handleCenterOnActiveStop() {
    const currentStop = allStops[activeStopIndex];
    if (currentStop && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: Number(currentStop.latitude),
          longitude: Number(currentStop.longitude),
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500
      );
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {allStops.slice(0, -1).map((stop, index) => {
          const nextStop = allStops[index + 1];
          const segmentKey = `${stop.id}->${nextStop.id}`;
          const segment = routeSegments[segmentKey];

          const isCurrentLeg = index === activeStopIndex;
          const isPastLeg = index < activeStopIndex;

          const strokeColor = isCurrentLeg
            ? '#22C55E' // Green for active leg
            : isPastLeg
            ? '#3B82F6' // Blue for visited leg
            : '#9CA3AF'; // Gray for upcoming leg

          const strokeWidth = isCurrentLeg ? 5 : 3;

          if (segment && segment.coordinates.length >= 2) {
            return (
              <Polyline
                key={`route-seg-${segmentKey}`}
                coordinates={segment.coordinates}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          }

          // Fallback straight line while route loads
          return (
            <Polyline
              key={`route-fallback-${segmentKey}`}
              coordinates={[
                { latitude: Number(stop.latitude), longitude: Number(stop.longitude) },
                { latitude: Number(nextStop.latitude), longitude: Number(nextStop.longitude) },
              ]}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              lineDashPattern={isCurrentLeg ? undefined : [5, 5]}
            />
          );
        })}

        {/* Trace réelle visitée */}
        {visitedPath.length >= 2 && (
          <Polyline
            key="visited-path-polyline"
            coordinates={visitedPath}
            strokeWidth={3}
            strokeColor="#3B82F6"
          />
        )}

        {/* Marqueurs d'étapes personnalisés 60 FPS */}
        {allStops.map((stop, index) => {
          const isCurrent = index === activeStopIndex;
          const isPast = index < activeStopIndex;
          const isNext = index === activeStopIndex + 1;

          let statusText = 'À venir';
          let pinBgColor = '#1F2937';
          let pinBorderColor = '#FFFFFF';

          if (isCurrent) {
            statusText = 'Étape actuelle';
            pinBgColor = '#16A34A';
            pinBorderColor = '#BBF7D0';
          } else if (isPast) {
            statusText = 'Visité';
            pinBgColor = '#2563EB';
          } else if (isNext) {
            statusText = 'Prochaine étape';
            pinBgColor = '#D97706';
          }

          return (
            <Marker
              key={`stop-${stop.id}-${isCurrent ? 'cur' : isPast ? 'past' : isNext ? 'next' : 'fut'}`}
              coordinate={{
                latitude: Number(stop.latitude),
                longitude: Number(stop.longitude),
              }}
              title={`Étape ${index + 1} — ${stop.name}`}
              description={`${statusText} • ${stop.stop_type === 'bar' ? 'Bar' : 'Restaurant'}`}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.stepPinContainer}>
                {isCurrent && <View style={styles.stepPinActiveHalo} />}
                <View
                  style={[
                    styles.stepPinBubble,
                    { backgroundColor: pinBgColor, borderColor: pinBorderColor },
                  ]}
                >
                  {isPast ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.stepPinNumber}>{index + 1}</Text>
                  )}
                </View>

                {/* Badge type (bar / resto) */}
                <View style={styles.stepPinBadge}>
                  <Ionicons
                    name={stop.stop_type === 'bar' ? 'beer' : 'restaurant'}
                    size={10}
                    color={stop.stop_type === 'bar' ? '#D97706' : '#2563EB'}
                  />
                </View>

                {/* Flèche pointeur */}
                <View style={[styles.stepPinArrow, { borderTopColor: pinBgColor }]} />
              </View>
            </Marker>
          );
        })}

        {/* Marqueurs GPS des amis */}
        {(friendLocations || [])
          .filter((f) => f.user_id !== currentUserId && f.latitude && f.longitude)
          .map((friend) => (
            <Marker
              key={`friend-${friend.user_id}`}
              coordinate={{
                latitude: Number(friend.latitude),
                longitude: Number(friend.longitude),
              }}
              title={friend.username}
              description={friend.is_guest ? 'Ami invité (En direct)' : 'Ami PubRush (En direct)'}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.friendMarkerContainer}>
                <View
                  style={[
                    styles.friendMarkerBubble,
                    friend.is_guest && styles.friendMarkerBubbleGuest,
                  ]}
                >
                  <Text style={styles.friendMarkerText}>
                    {friend.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendMarkerArrow} />
                <View style={styles.friendMarkerNameBadge}>
                  <Text style={styles.friendMarkerNameText} numberOfLines={1}>
                    {friend.username}
                  </Text>
                </View>
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Boutons flottants de recentrage carte */}
      <View style={styles.mapControlsContainer}>
        <TouchableOpacity
          style={styles.mapControlButton}
          activeOpacity={0.85}
          onPress={handleCenterOnMe}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="locate" size={22} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapControlButton}
          activeOpacity={0.85}
          onPress={handleCenterOnActiveStop}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="flag" size={20} color="#16A34A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
