import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';

import { ActiveBarathonStop, LatLng } from '../types/activeBarathon.types';
import { styles } from '../styles/activeBarathon.styles';

type Props = {
  initialRegion: Region;
  currentLocation: LatLng | null;
  visitedPath: LatLng[];
  allStops: ActiveBarathonStop[];
  activeStopIndex: number;
};

export default function ActiveBarathonMap({
  initialRegion,
  currentLocation,
  visitedPath,
  allStops,
  activeStopIndex,
}: Props) {
  // Stores the coordinate arrays for the routes between each stop
  // Key format: `${from.id}-${to.id}` to uniquely identify a route segment
  const [routeGeometries, setRouteGeometries] = useState<
    Record<string, LatLng[]>
  >({});

  // Re-fetch or calculate routes when the list of stops changes
  useEffect(() => {
    let active = true;

    async function loadRouteGeometries() {
      if (allStops.length < 2) {
        setRouteGeometries({});
        return;
      }

      const newGeometries = { ...routeGeometries };
      let hasNewChange = false;

      // Loop through all stops to fetch the route to the next stop
      for (let i = 0; i < allStops.length - 1; i++) {
        if (!active) return;
        const from = allStops[i];
        const to = allStops[i + 1];
        const key = `${from.id}-${to.id}`;

        // Only fetch if we don't already have the geometry for this segment
        if (!newGeometries[key]) {
          try {
            // Fetch full walking route geometry from OSRM public API
            const url = `https://router.project-osrm.org/route/v1/foot/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?geometries=geojson&overview=full`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.routes && data.routes.length > 0 && active) {
              // Map GeoJSON coordinates ([lon, lat]) to React Native Maps LatLng ({latitude, longitude})
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
            console.error(`Failed to fetch OSRM active route for ${key}:`, error);
          }
        }
      }

      // Only update state if we fetched new route geometries to avoid unnecessary re-renders
      if (hasNewChange && active) {
        setRouteGeometries(newGeometries);
      }
    }

    void loadRouteGeometries();

    return () => {
      active = false;
    };
  }, [allStops]);

  return (
    <MapView
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {[
        ...allStops.slice(0, -1).map((stop, index) => {
          const nextStop = allStops[index + 1];

          const key = `active-polyline-${stop.id}-${nextStop.id}`;
          const path = routeGeometries[`${stop.id}-${nextStop.id}`];

          // Determine if this segment is currently active, already completed, or in the future
          const isCurrentLeg = index === activeStopIndex;
          const isPastLeg = index < activeStopIndex;

          // Apply distinct colors and widths to differentiate the segments visually
          const strokeColor = isCurrentLeg
            ? '#22C55E' // Green for the current leg (highlighted)
            : isPastLeg
            ? '#3B82F6' // Blue for already completed legs
            : '#9CA3AF'; // Gray for future legs

          const strokeWidth = isCurrentLeg ? 5 : 3;

          if (path && path.length >= 2) {
            return (
              <Polyline
                key={key}
                coordinates={path}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          } else {
            return (
              <Polyline
                key={key}
                coordinates={[
                  { latitude: stop.latitude, longitude: stop.longitude },
                  { latitude: nextStop.latitude, longitude: nextStop.longitude },
                ]}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                lineDashPattern={isCurrentLeg ? undefined : [5, 5]}
              />
            );
          }
        }),
        ...(visitedPath.length >= 2
          ? [
              <Polyline
                key="visited-path-polyline"
                coordinates={visitedPath}
                strokeWidth={4}
                strokeColor="#2563EB"
              />,
            ]
          : []),
        ...allStops.map((stop, index) => {
          const isCurrent = index === activeStopIndex;
          const isPast = index < activeStopIndex;
          const isNext = index === activeStopIndex + 1;

          let statusText = 'À venir'; // Upcoming
          let pinColor = 'red'; // Red for upcoming (100% iOS compatible)
          if (isCurrent) {
            statusText = 'Étape actuelle'; // Current step
            pinColor = 'green'; // Green (100% iOS compatible)
          } else if (isPast) {
            statusText = 'Visité'; // Visited
            pinColor = 'purple'; // Purple (100% iOS compatible)
          } else if (isNext) {
            statusText = 'Prochaine étape'; // Next step
            pinColor = 'purple'; // Purple (100% iOS compatible)
          }

          return (
            <Marker
              // IMPORTANT: Include status in the key so that React Native Maps forces a re-render
              // of the pin when its color changes. Otherwise, markers might cache their previous appearance.
              key={`stop-${stop.id}-${isCurrent ? 'current' : isPast ? 'past' : isNext ? 'next' : 'future'}`}
              coordinate={{
                latitude: Number(stop.latitude),
                longitude: Number(stop.longitude),
              }}
              title={`Étape ${index + 1} - ${stop.name}`}
              description={`${statusText} • ${stop.stop_type === 'bar' ? '🍻 Bar' : '🍔 Restaurant'}`}
              pinColor={pinColor}
            />
          );
        }),
      ]}
    </MapView>
  );
}
