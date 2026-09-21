export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RouteSegment = {
  coordinates: LatLng[];
  durationMinutes: number;
  distanceMeters: number;
};

// In-memory cache for route queries during the session
const ROUTE_CACHE = new Map<string, RouteSegment>();

function getCacheKey(from: LatLng, to: LatLng): string {
  return `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}->${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`;
}

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function getHaversineDistanceKm(from: LatLng, to: LatLng): number {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/**
 * Calculates straight-line walking time assuming 4.0 km/h realistic urban pedestrian pace.
 */
export function getStraightLineWalkingMinutes(from: LatLng, to: LatLng): number {
  const distKm = getHaversineDistanceKm(from, to);
  return Math.max(1, Math.round((distKm / 4.8) * 60));
}

/**
 * Fetches the real pedestrian street-following route from OSRM.
 * Falls back to straight-line if offline, timed out, or in error.
 */
export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<RouteSegment> {
  const cacheKey = getCacheKey(from, to);
  if (ROUTE_CACHE.has(cacheKey)) {
    return ROUTE_CACHE.get(cacheKey)!;
  }

  const fallbackDistanceMeters = Math.round(getHaversineDistanceKm(from, to) * 1000);
  const fallbackMinutes = getStraightLineWalkingMinutes(from, to);
  const fallbackSegment: RouteSegment = {
    coordinates: [from, to],
    durationMinutes: fallbackMinutes,
    distanceMeters: fallbackDistanceMeters,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/foot/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return fallbackSegment;
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return fallbackSegment;
    }

    const route = data.routes[0];
    const rawCoords = route.geometry?.coordinates || [];
    const coordinates: LatLng[] = rawCoords.map(([lon, lat]: [number, number]) => ({
      latitude: lat,
      longitude: lon,
    }));

    // Exact optimized pedestrian footway duration (matching Google Maps pace)
    const rawDurationSec = Number(route.duration) || 0;
    const walkingMinutes = Math.max(1, Math.round(rawDurationSec / 60));
    const distanceMeters = Math.round(Number(route.distance) || fallbackDistanceMeters);

    const result: RouteSegment = {
      coordinates: coordinates.length >= 2 ? coordinates : [from, to],
      durationMinutes: walkingMinutes,
      distanceMeters,
    };

    ROUTE_CACHE.set(cacheKey, result);
    return result;
  } catch {
    return fallbackSegment;
  }
}

/**
 * Returns the midpoint coordinate of a polyline for rendering duration pill badges.
 */
export function getRouteMidpoint(coordinates: LatLng[]): LatLng | null {
  if (!coordinates || coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];

  const middleIndex = Math.floor(coordinates.length / 2);
  return coordinates[middleIndex];
}

/**
 * Efficiently computes walking routes for a list of points in parallel,
 * reusing any already cached or known segments to avoid redundant network calls.
 */
export async function fetchWalkingRoutesInParallel(
  points: { id: string; latitude: number; longitude: number }[],
  existingSegments: Record<string, RouteSegment> = {}
): Promise<Record<string, RouteSegment>> {
  if (points.length < 2) {
    return {};
  }

  const updatedSegments: Record<string, RouteSegment> = {};
  const tasks: { key: string; from: LatLng; to: LatLng }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const key = `${from.id}->${to.id}`;

    if (existingSegments[key]) {
      updatedSegments[key] = existingSegments[key];
    } else {
      tasks.push({
        key,
        from: { latitude: Number(from.latitude), longitude: Number(from.longitude) },
        to: { latitude: Number(to.latitude), longitude: Number(to.longitude) },
      });
    }
  }

  if (tasks.length === 0) {
    return updatedSegments;
  }

  const results = await Promise.all(
    tasks.map(async (task) => {
      const seg = await fetchWalkingRoute(task.from, task.to);
      return { key: task.key, seg };
    })
  );

  for (const res of results) {
    updatedSegments[res.key] = res.seg;
  }

  return updatedSegments;
}

/**
 * Optimizes the order of stops to minimize the total walking distance (TSP - Traveling Salesperson).
 * Keeps the first stop (the starting bar) fixed, and calculates the optimal sequence for the rest.
 */
export function optimizeStopOrder<T extends LatLng>(stops: T[]): T[] {
  if (stops.length <= 2) {
    return stops;
  }

  const firstStop = stops[0];
  const remainingStops = stops.slice(1);

  // For up to 8 remaining stops (<= 40,320 permutations), use exact permutation search
  if (remainingStops.length <= 8) {
    let bestOrder = remainingStops;
    let minDistance = Infinity;

    function permute(arr: T[], m: T[] = []) {
      if (arr.length === 0) {
        const fullCandidate = [firstStop, ...m];
        let totalDist = 0;
        for (let i = 0; i < fullCandidate.length - 1; i++) {
          totalDist += getHaversineDistanceKm(fullCandidate[i], fullCandidate[i + 1]);
        }
        if (totalDist < minDistance) {
          minDistance = totalDist;
          bestOrder = m;
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    }

    permute(remainingStops);
    return [firstStop, ...bestOrder];
  }

  // Nearest neighbor heuristic for larger lists
  const unvisited = [...remainingStops];
  const result = [firstStop];
  let current = firstStop;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getHaversineDistanceKm(current, unvisited[i]);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    current = unvisited.splice(nearestIndex, 1)[0];
    result.push(current);
  }

  return result;
}
