import MapView, { Marker, Polyline, Region } from 'react-native-maps';

import { ActiveBarathonStop, LatLng } from '../types/activeBarathon.types';
import { styles } from '../styles/activeBarathon.styles';

type Props = {
  initialRegion: Region;
  currentLocation: LatLng | null;
  routeCoordinates: LatLng[];
  visitedPath: LatLng[];
  visibleStops: ActiveBarathonStop[];
};

export default function ActiveBarathonMap({
  initialRegion,
  currentLocation,
  routeCoordinates,
  visitedPath,
  visibleStops,
}: Props) {
  return (
    <MapView
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {routeCoordinates.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={4}
          strokeColor="#22C55E"
        />
      ) : null}

      {visitedPath.length >= 2 ? (
        <Polyline
          coordinates={visitedPath}
          strokeWidth={4}
          strokeColor="#2563EB"
        />
      ) : null}

      {visibleStops.map((stop, index) => (
        <Marker
          key={stop.id}
          coordinate={{
            latitude: stop.latitude,
            longitude: stop.longitude,
          }}
          title={stop.name}
          description={index === 0 ? 'Arrêt courant' : 'Prochain arrêt'}
        />
      ))}
    </MapView>
  );
}
