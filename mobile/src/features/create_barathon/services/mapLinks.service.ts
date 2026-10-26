import type { LatLng } from './routing.service';

const valid = (point: LatLng) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
  Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;

// Maps URLs open the consumer app/browser; no billed Directions API or key.
export function getWalkingDirectionsUrl(from: LatLng | null, to: LatLng | null): string | null {
  if (!to || !valid(to) || (from && !valid(from))) return null;
  const origin = from ? `&origin=${encodeURIComponent(`${from.latitude},${from.longitude}`)}` : '';
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(`${to.latitude},${to.longitude}`)}&travelmode=walking`;
}
