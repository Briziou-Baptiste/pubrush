import type { LatLng } from './routing.service';

export function getSearchCenter<T extends LatLng>(points: T[], fallback: LatLng | null | undefined): LatLng | undefined {
  return points.length ? points[points.length - 1] : fallback ?? undefined;
}

export function appendSelectedStops<T>(selected: T[], additions: T[]): T[] {
  return [...selected, ...additions];
}

export function getModificationSearchCenter(
  current: LatLng | null, last: LatLng | null,
  mode: 'replace' | 'add', position: 'before_current' | 'after_current' | 'at_end',
  fallback: LatLng,
): LatLng {
  return (mode === 'add' && position === 'at_end' ? last : current) ?? fallback;
}
