import { LatLng } from '../types/activeBarathon.types';

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(from: LatLng, to: LatLng) {
  const earthRadiusMeters = 6371000;

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
  return earthRadiusMeters * c;
}

export function isWithinStopRadius(
  currentLocation: LatLng | null,
  stopLocation: LatLng | null,
  radiusMeters = 10
) {
  if (!currentLocation || !stopLocation) {
    return false;
  }

  return getDistanceMeters(currentLocation, stopLocation) <= radiusMeters;
}
