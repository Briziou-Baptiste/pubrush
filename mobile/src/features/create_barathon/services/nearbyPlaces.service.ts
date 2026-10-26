import { getHaversineDistanceKm, type LatLng } from './routing.service';
import type { BarSearchResult } from '../types/createBarathon.types';

type NamedPoint = LatLng & { name: string };
const normalizeName = (name: string) => name.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim();

export function isSameVenue(a: NamedPoint, b: NamedPoint): boolean {
  return normalizeName(a.name) === normalizeName(b.name) &&
    getHaversineDistanceKm(a, b) * 1000 <= 10;
}

export function selectNearbySuggestions(
  candidates: BarSearchResult[], selected: NamedPoint[], center: LatLng, maxMinutes: number,
): BarSearchResult[] {
  const unique: BarSearchResult[] = [];
  for (const candidate of candidates) {
    if (!candidate.name || !Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude) ||
        Math.abs(candidate.latitude) > 90 || Math.abs(candidate.longitude) > 180) continue;
    const distance = getHaversineDistanceKm(center, candidate) * 1000;
    const distanceMeters = Math.round(distance);
    if (distance > maxMinutes * 80 ||
        (candidate.estimatedMinutes != null && candidate.estimatedMinutes > maxMinutes) ||
        selected.some(point => isSameVenue(point, candidate)) ||
        unique.some(point => isSameVenue(point, candidate))) continue;
    unique.push({ ...candidate, distanceMeters });
  }
  return unique.sort((a, b) => {
    const minutesA = a.estimatedMinutes ?? Infinity;
    const minutesB = b.estimatedMinutes ?? Infinity;
    return (minutesA === minutesB ? 0 : minutesA - minutesB) || a.distanceMeters! - b.distanceMeters!;
  }).slice(0, 50);
}
