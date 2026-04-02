import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';

type PointMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type PendingPoint = {
  latitude: number;
  longitude: number;
} | null;

type Props = {
  initialRegion: Region;
  userLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  selectedPoints: PointMarker[];
  pendingPoint: PendingPoint;
  onMapPress: (event: MapPressEvent) => void;
};

const DEFAULT_ZOOM_REGION_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function BarathonPointPickerMap({
  initialRegion,
  userLocation,
  selectedPoints,
  pendingPoint,
  onMapPress,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const computedInitialRegion = useMemo(() => {
    if (!userLocation) {
      return initialRegion;
    }

    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      ...DEFAULT_ZOOM_REGION_DELTA,
    };
  }, [initialRegion, userLocation]);

  useEffect(() => {
    if (!userLocation) return;

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        zoom: 16,
      },
      { duration: 800 }
    );
  }, [userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={computedInitialRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={onMapPress}
      >
        {selectedPoints.map((point) => (
          <Marker
            key={point.id}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.name}
            description={`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`}
          />
        ))}

        {pendingPoint ? (
          <Marker
            coordinate={{
              latitude: pendingPoint.latitude,
              longitude: pendingPoint.longitude,
            }}
            title="Point sélectionné"
            description="En attente de confirmation"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
