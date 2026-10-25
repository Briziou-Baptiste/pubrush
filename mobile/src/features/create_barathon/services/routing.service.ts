export type LatLng = { latitude: number; longitude: number };
export type RoutePoint = LatLng & { id: string };

export type RouteSegment = {
  status: 'walking' | 'straight_line' | 'unavailable';
  coordinates: LatLng[];
  durationMinutes: number | null;
  distanceMeters: number | null;
  requestKey: string;
  fetchedAt: number;
};

// This prefix selects a graph built with the pedestrian profile (the URL's /foot alone does not).
export const WALKING_BASE_URL = 'https://routing.openstreetmap.de/routed-foot';
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_SIZE = 200;
const REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;

export function getRouteRequestKey(from: LatLng, to: LatLng): string {
  return `${WALKING_BASE_URL}:foot:${Number(from.latitude)},${Number(from.longitude)}->${Number(to.latitude)},${Number(to.longitude)}`;
}
export function getRouteSegmentKey(from: RoutePoint, to: RoutePoint): string {
  return `${from.id}->${to.id}:${getRouteRequestKey(from, to)}`;
}
export function getHaversineDistanceKm(from: LatLng, to: LatLng): number {
  const rad = (value: number) => value * Math.PI / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) *
    Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function getStraightLineWalkingMinutes(from: LatLng, to: LatLng): number {
  return Math.max(1, Math.round(getHaversineDistanceKm(from, to) / 4.8 * 60));
}
const validPoint = (point: LatLng) => Number.isFinite(point.latitude) &&
  Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
const validMetric = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Dependencies make provider failures, expiry and the shared request queue deterministic in tests.
export function createWalkingRouter(deps: {
  enabled?: boolean;
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}) {
  const cache = new Map<string, RouteSegment>();
  const pending = new Map<string, Promise<RouteSegment>>();
  let queue = Promise.resolve();
  let lastStarted = -Infinity;

  async function request(from: LatLng, to: LatLng): Promise<RouteSegment> {
    const requestKey = getRouteRequestKey(from, to);
    const result = (status: RouteSegment['status']): RouteSegment => ({
      status, requestKey, fetchedAt: deps.now(), durationMinutes: null,
      distanceMeters: status === 'straight_line' ? Math.round(getHaversineDistanceKm(from, to) * 1000) : null,
      coordinates: status === 'straight_line' ? [from, to] : [],
    });
    if (!validPoint(from) || !validPoint(to)) return result('unavailable');
    // Public demo terms restrict substantial commercial use. Enable only for an eligible context.
    if (!deps.enabled) return result('straight_line');
    const cached = cache.get(requestKey);
    if (cached && deps.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
    cache.delete(requestKey);
    await deps.sleep(Math.max(0, REQUEST_INTERVAL_MS - (deps.now() - lastStarted)));
    lastStarted = deps.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
      const response = await deps.fetch(`${WALKING_BASE_URL}/route/v1/foot/${coords}?overview=simplified&geometries=geojson&radiuses=75;75`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PubRush/1.0 (+https://pubrush.com)' },
      });
      const data = await response.json();
      if (data.code === 'NoRoute' || data.code === 'NoSegment') return result('unavailable');
      if (!response.ok || data.code !== 'Ok') return result('straight_line');
      const route = data.routes?.[0];
      const rawCoords = route?.geometry?.coordinates;
      if (!validMetric(route?.duration) || !validMetric(route?.distance) ||
          route?.geometry?.type !== 'LineString' || !Array.isArray(rawCoords) || rawCoords.length < 2 ||
          !rawCoords.every((c: unknown) => Array.isArray(c) && c.length >= 2 && validPoint({ longitude: c[0], latitude: c[1] })) ||
          !Array.isArray(data.waypoints) || data.waypoints.length !== 2 ||
          !data.waypoints.every((w: { distance: unknown }) => validMetric(w?.distance) && w.distance <= 75)) {
        return result('straight_line');
      }
      const segment: RouteSegment = {
        ...result('walking'),
        coordinates: rawCoords.map(([longitude, latitude]: number[]) => ({ latitude, longitude })),
        durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        distanceMeters: Math.round(route.distance),
      };
      if (cache.size >= CACHE_MAX_SIZE) cache.delete(cache.keys().next().value!);
      cache.set(requestKey, segment);
      return segment;
    } catch {
      return result('straight_line');
    } finally {
      clearTimeout(timer);
    }
  }

  function fetchRoute(from: LatLng, to: LatLng): Promise<RouteSegment> {
    // Snapshot inputs: an edit while waiting must not alter an in-flight request.
    from = { latitude: Number(from.latitude), longitude: Number(from.longitude) };
    to = { latitude: Number(to.latitude), longitude: Number(to.longitude) };
    const key = getRouteRequestKey(from, to);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const task = queue.then(() => request(from, to));
    queue = task.then(() => undefined, () => undefined);
    pending.set(key, task);
    void task.finally(() => pending.delete(key));
    return task;
  }
  async function fetchRoutes(points: RoutePoint[]): Promise<Record<string, RouteSegment>> {
    const entries = await Promise.all(points.slice(0, -1).map(async (from, i) => {
      const to = points[i + 1];
      return [getRouteSegmentKey(from, to), await fetchRoute(from, to)] as const;
    }));
    return Object.fromEntries(entries);
  }
  return { fetchRoute, fetchRoutes };
}
const router = createWalkingRouter({
  // Release/OTA bundles must stay off even if an EAS environment accidentally carries the flag.
  enabled: typeof __DEV__ !== 'undefined' && __DEV__ &&
    process.env.EXPO_PUBLIC_WALKING_ROUTING_ENABLED === 'true',
  fetch: (...args) => fetch(...args), now: Date.now,
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
});
export const fetchWalkingRoute = router.fetchRoute;
// Kept name for callers; the shared queue spaces all network requests, including other screens.
export const fetchWalkingRoutesInParallel = router.fetchRoutes;

export function getRouteLabel(segment?: RouteSegment | null): string {
  if (!segment) return 'Calcul de l’itinéraire…';
  if (segment.status === 'unavailable') return 'Aucun itinéraire piéton trouvé';
  if (segment.status === 'straight_line') return `${segment.distanceMeters} m à vol d’oiseau · trajet indisponible`;
  return `Piéton calculé : ${segment.durationMinutes} min • ${segment.distanceMeters} m`;
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
 * Approximates stop order using straight-line distances, not a pedestrian travel matrix.
 * Keeps the first stop (the starting bar) fixed, and calculates the optimal sequence for the rest.
 */
export function optimizeStopOrder<T extends LatLng>(stops: T[]): T[] {
  if (stops.length <= 2) {
    return stops;
  }

  const n = stops.length;
  // Precompute N x N distance matrix so permutations perform instant array lookups (O(1))
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = getHaversineDistanceKm(stops[i], stops[j]);
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }
  }

  const firstStop = stops[0];
  const remainingIndices = Array.from({ length: n - 1 }, (_, k) => k + 1);

  // For up to 8 remaining stops (<= 40,320 permutations), use exact permutation search with matrix lookups
  if (remainingIndices.length <= 8) {
    let bestIndices: number[] = remainingIndices;
    let minDistance = Infinity;

    function permute(arr: number[], m: number[] = []) {
      if (arr.length === 0) {
        let totalDist = distMatrix[0][m[0]];
        for (let i = 0; i < m.length - 1; i++) {
          totalDist += distMatrix[m[i]][m[i + 1]];
        }
        if (totalDist < minDistance) {
          minDistance = totalDist;
          bestIndices = m;
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr, m.concat(next));
        }
      }
    }

    permute(remainingIndices);
    return [firstStop, ...bestIndices.map((idx) => stops[idx])];
  }

  // Nearest neighbor heuristic for larger lists using distance matrix
  const unvisited = [...remainingIndices];
  const resultIndices = [0];
  let currentIdx = 0;

  while (unvisited.length > 0) {
    let nearestPos = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const targetIdx = unvisited[i];
      const dist = distMatrix[currentIdx][targetIdx];
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPos = i;
      }
    }

    currentIdx = unvisited.splice(nearestPos, 1)[0];
    resultIndices.push(currentIdx);
  }

  return resultIndices.map((idx) => stops[idx]);
}
