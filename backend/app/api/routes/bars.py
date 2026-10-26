import os
import json
import urllib.request
import urllib.parse
import ssl
import math
import re
import unicodedata
import logging
from threading import Lock
from fastapi import APIRouter, Depends, HTTPException, Response, status
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps.auth import get_current_user
from app.models import User, MapFilter
import time
from app.schemas import BarSearchResult


# A list preserves the existing JSON contract; metadata travels in response headers.
class NearbyResults(list):
    def __init__(self, items=(), *, provider="overpass", raw_count=0, limited=False, reason="complete", filtered_count=None):
        super().__init__(items)
        self.provider = provider
        self.raw_count = raw_count
        self.limited = limited
        self.reason = reason
        self.filtered_count = len(self) if filtered_count is None else filtered_count


def _nearby_response(results, response=None, *, cached=False):
    provider = getattr(results, "provider", "unknown")
    raw = getattr(results, "raw_count", len(results))
    filtered = getattr(results, "filtered_count", len(results))
    limited = getattr(results, "limited", False)
    reason = getattr(results, "reason", "unknown")
    if response is not None:
        response.headers.update({
            "X-Places-Provider": provider,
            "X-Places-Raw-Count": str(raw),
            "X-Places-Filtered-Count": str(filtered),
            "X-Places-Returned-Count": str(len(results)),
            "X-Places-Limited": "true" if limited else "false",
            "X-Places-Reason": reason,
        })
    # Enumerated reasons and counts only: never URLs, positions, names or exception text.
    logging.getLogger("uvicorn.error").info(
        "places.nearby provider=%s raw=%d filtered=%d returned=%d limited=%s reason=%s cached=%s",
        provider, raw, filtered, len(results), limited, reason, cached,
    )
    return results


class ExpiringCache:
    """In-memory cache with TTL and maximum size to prevent memory leaks."""

    def __init__(self, max_size: int = 500, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: dict[tuple, tuple] = {}

    def get(self, key):
        if key in self._cache:
            val, exp = self._cache[key]
            if time.time() < exp:
                return val
            del self._cache[key]
        return None

    def set(self, key, value):
        now = time.time()
        if len(self._cache) >= self.max_size:
            expired = [k for k, (_, exp) in self._cache.items() if exp <= now]
            for k in expired:
                del self._cache[k]
            if len(self._cache) >= self.max_size:
                to_remove = list(self._cache.keys())[: max(1, self.max_size // 5)]
                for k in to_remove:
                    del self._cache[k]
        self._cache[key] = (value, now + self.ttl_seconds)

    def __contains__(self, key):
        return self.get(key) is not None

    def __getitem__(self, key):
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __setitem__(self, key, value):
        self.set(key, value)

    def clear(self):
        self._cache.clear()

    def __len__(self):
        return len(self._cache)


NEARBY_CACHE = ExpiringCache(max_size=300, ttl_seconds=300)
SEARCH_CACHE = ExpiringCache(max_size=300, ttl_seconds=300)

router = APIRouter(prefix="/bars", tags=["bars"])


def _http_get_json(url: str, data_encoded: bytes = None, headers: dict = None, timeout: int = 5) -> dict:
    req_headers = {"User-Agent": "PubRush-FastAPI/1.0"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, data=data_encoded, headers=req_headers)
    if os.getenv("ALLOW_INSECURE_SSL", "").lower() == "true":
        ssl_context = ssl._create_unverified_context()
    else:
        ssl_context = ssl.create_default_context()

    with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as response:
        return json.loads(response.read().decode("utf-8"))

@router.get("/search", response_model=list[BarSearchResult])
def search_bars(
    q: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    filter_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query_str = q.strip()
    if len(query_str) < 2:
        return []

    # Round coordinates to 3 decimal places (~110 meters of precision) to hit caches during autocomplete searches
    lat_key = round(lat, 3) if lat is not None else None
    lon_key = round(lon, 3) if lon is not None else None
    cache_key = (query_str.lower(), lat_key, lon_key, filter_key)

    # Check search cache for hits
    if cache_key in SEARCH_CACHE:
        return SEARCH_CACHE[cache_key]

    # Fetch custom query from DB if filter_key is provided
    google_type = None
    if filter_key:
        filter_obj = db.scalar(select(MapFilter).where(MapFilter.key == filter_key))
        if filter_obj:
            google_type = filter_obj.google_type

    provider = os.getenv("PLACE_SEARCH_PROVIDER", "photon").lower()
    results = []

    if provider == "google":
        key = os.getenv("GOOGLE_PLACES_API_KEY")
        if not key:
            # Fallback on photon if key is missing to avoid crashing
            provider = "photon"
        else:
            results = search_google_places(query_str, lat, lon, key, google_type, filter_key)

    if provider == "photon":
        results = search_photon(query_str, lat, lon, filter_key)

    # Prioritize/only show results in the user's city (within 35 km) if possible
    if lat is not None and lon is not None and results:
        local_results = []
        for r in results:
            # Calculate distance in km (Haversine)
            dlat = math.radians(r.latitude - lat)
            dlon = math.radians(r.longitude - lon)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(r.latitude)) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist_km = 6371.0 * c
            if dist_km <= 35.0:
                local_results.append(r)
        if local_results:
            results = local_results

    # Limit the cache size to prevent potential memory leaks / excessive memory usage
    if len(SEARCH_CACHE) > 200:
        SEARCH_CACHE.clear()
    SEARCH_CACHE[cache_key] = results

    return results

def search_photon(q: str, lat: Optional[float], lon: Optional[float], filter_key: Optional[str] = None, *, timeout: float = 5):
    query_params = {"q": q, "limit": 15}  # Request slightly more to allow filtering
    if filter_key == 'bar':
        query_params['osm_tag'] = ['amenity:pub', 'amenity:bar', 'amenity:biergarten', 'amenity:nightclub']
    elif filter_key == 'food':
        query_params['osm_tag'] = ['amenity:restaurant', 'amenity:fast_food', 'amenity:cafe', 'amenity:food_court']
    if lat is not None and lon is not None:
        query_params["lat"] = str(lat)
        query_params["lon"] = str(lon)
        query_params["location_bias_scale"] = "0.2"

    url = f"https://photon.komoot.io/api/?{urllib.parse.urlencode(query_params, doseq=True)}"
    
    try:
        data = _http_get_json(url, timeout=timeout)
            
        results = []
        for feature in data.get("features", []):
            coords = feature.get("geometry", {}).get("coordinates", [])
            props = feature.get("properties", {})
            
            if len(coords) < 2 or not props.get("name"):
                continue
                
            osm_key = props.get("osm_key", "")
            osm_val = props.get("osm_value", "")
            
            # If a filter is active, check if it matches the osm_key/osm_value
            if filter_key:
                # Dynamic matching rules
                if filter_key == "bar":
                    if not (osm_key == "amenity" and osm_val in ["pub", "bar", "biergarten", "nightclub"]):
                        continue
                elif filter_key == "food":
                    if not (osm_key == "amenity" and osm_val in ["restaurant", "fast_food", "cafe", "food_court"]):
                        continue
                elif filter_key == "first_aid":
                    if not ((osm_key == "amenity" and osm_val in ["hospital", "first_aid"]) or 
                            (osm_key == "emergency" and osm_val in ["first_aid_station"])):
                        continue
                elif filter_key == "challenge":
                    if not ((osm_key == "amenity" and osm_val in ["townhall", "community_centre"]) or 
                            osm_key in ["historic", "tourism"] or osm_val in ["monument", "landmark"]):
                        continue
                elif filter_key == "partner_restaurant":
                    if not (osm_key == "amenity" and osm_val == "restaurant"):
                        continue
                
                stop_type = filter_key
            else:
                stop_type = "bar" if osm_val in ["bar", "pub", "biergarten", "nightclub"] else "food"
            
            results.append(
                BarSearchResult(
                    name=props.get("name"),
                    street=props.get("street"),
                    city=props.get("city"),
                    country=props.get("country"),
                    latitude=coords[1],
                    longitude=coords[0],
                    stop_type=stop_type
                )
            )
        return NearbyResults(results[:10], provider="photon", raw_count=len(data.get("features", [])),
                             limited=True, reason="photon_geocoder", filtered_count=len(results))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur lors de la requête OpenStreetMap (Photon) : {str(e)}"
        )

def search_google_places(q: str, lat: Optional[float], lon: Optional[float], key: str, google_type: Optional[str] = None, filter_key: Optional[str] = None):
    query_params = {
        "query": q,
        "key": key,
        "language": "fr"
    }
    if google_type:
        query_params["type"] = google_type

    if lat is not None and lon is not None:
        query_params["location"] = f"{lat},{lon}"
        query_params["radius"] = "5000"

    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?{urllib.parse.urlencode(query_params)}"
    
    try:
        data = _http_get_json(url, timeout=5)
            
        status_google = data.get("status")
        if status_google not in ["OK", "ZERO_RESULTS"]:
            raise Exception(f"Google API error status: {status_google}")
            
        results = []
        for result in data.get("results", []):
            loc = result.get("geometry", {}).get("location", {})
            lat_val = loc.get("lat")
            lon_val = loc.get("lng")
            
            if lat_val is None or lon_val is None or not result.get("name"):
                continue
                
            address = result.get("formatted_address", "")
            street = None
            city = None
            country = None
            
            parts = [p.strip() for p in address.split(",")]
            if len(parts) >= 1:
                street = parts[0]
            if len(parts) >= 2:
                city_part = parts[1]
                city_words = city_part.split()
                city = " ".join([w for w in city_words if not w.isdigit()])
            if len(parts) >= 3:
                country = parts[2]
                
            types = result.get("types", [])
            is_bar = "bar" in types or "night_club" in types
            
            if not is_bar and ("restaurant" in types or "cafe" in types or "food" in types):
                computed_stop_type = "food"
            else:
                computed_stop_type = "bar" if is_bar else "food"

            if filter_key:
                if filter_key == "bar" and not is_bar:
                    continue
                if filter_key == "food" and is_bar:
                    continue
                stop_type = filter_key if filter_key not in ["bar", "food"] else computed_stop_type
            else:
                stop_type = computed_stop_type
                
            results.append(
                BarSearchResult(
                    name=result.get("name"),
                    street=street,
                    city=city,
                    country=country,
                    latitude=lat_val,
                    longitude=lon_val,
                    stop_type=stop_type
                )
            )
        return results
    except Exception as e:
        # Silent fallback to Photon if Google request fails
        return search_photon(q, lat, lon, filter_key)

def get_straight_line_walking_minutes(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """
    Computes straight-line (Haversine) distance and translates it to walking minutes
    based on a realistic urban pedestrian speed of 4.8 km/h.
    """
    R_earth = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_km = R_earth * c
    hours = dist_km / 4.8  # 4.8 km/h walking speed (brisk urban profile matching Google Maps)
    return max(1, int(round(hours * 60.0)))


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rad = math.radians
    a = (math.sin(rad(lat2 - lat1) / 2) ** 2 + math.cos(rad(lat1)) *
         math.cos(rad(lat2)) * math.sin(rad(lon2 - lon1) / 2) ** 2)
    return 6371000 * 2 * math.asin(math.sqrt(min(1, a)))


def _venue_name(name: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', name.casefold())
                   if not unicodedata.combining(c)).strip()


def _unique_nearby(results: list[BarSearchResult]) -> list[BarSearchResult]:
    # Only merge coincident OSM representations of the same named venue.
    # Two branches with the same name or adjacent, differently named bars stay distinct.
    unique = []
    for result in results:
        if not any(_venue_name(result.name) == _venue_name(other.name) and
                   (not result.street or not other.street or result.street == other.street) and
                   distance_meters(result.latitude, result.longitude, other.latitude, other.longitude) <= 10
                   for other in unique):
            unique.append(result)
    return unique

# Per-process admission limit; busy provider leaves durations unknown.
_WALKING_REQUEST_LOCK = Lock()
_walking_next_request_at = 0.0
WALKING_BASE_URL = "https://routing.openstreetmap.de/routed-foot"


def _walking_routing_enabled() -> bool:
    # This demo is reserved for an explicit private test, never the production deployment.
    return (os.getenv("ENVIRONMENT", "development").lower() != "production" and
            os.getenv("WALKING_ROUTING_ENABLED", "").lower() == "true")


def compute_real_walking_times(lat: float, lon: float, candidates: list[BarSearchResult]) -> list[BarSearchResult]:
    global _walking_next_request_at
    if not candidates:
        return []
    for candidate in candidates:
        candidate.estimated_minutes = None
    # The public demo is not eligible by default for substantial commercial routing use.
    if not _walking_routing_enabled():
        return candidates
    # Query all search candidates in one matrix, so unqueried Haversine times cannot outrank routes.
    coords = ";".join([f"{lon},{lat}"] + [f"{c.longitude},{c.latitude}" for c in candidates])
    radiuses = ";".join(["75"] * (len(candidates) + 1))
    url = f"{WALKING_BASE_URL}/table/v1/foot/{coords}?sources=0&radiuses={radiuses}"
    with _WALKING_REQUEST_LOCK:
        now = time.monotonic()
        if now < _walking_next_request_at:
            return candidates
        _walking_next_request_at = now + 1.1
    try:
        data = _http_get_json(url, timeout=5)
        durations = data.get("durations")
        if data.get("code") != "Ok" or not isinstance(durations, list) or len(durations) != 1:
            return candidates
        row = durations[0]
        if not isinstance(row, list) or len(row) != len(candidates) + 1:
            return candidates
        if any(value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or
               not math.isfinite(value) or value < 0) for value in row):
            return candidates
        reachable = []
        for candidate, seconds in zip(candidates, row[1:]):
            if seconds is None:
                continue  # Explicitly unreachable; never substitute a straight-line time.
            candidate.estimated_minutes = max(1, int(round(seconds / 60)))
            reachable.append(candidate)
        return reachable
    except Exception:
        return candidates  # Network failure: retain unknown durations, unchanged API schema.

@router.get("/nearby", response_model=list[BarSearchResult])
def get_nearby_bars(
    lat: float,
    lon: float,
    max_travel_time_minutes: int,
    filter_key: Optional[str] = None,
    response: Response = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if max_travel_time_minutes <= 0:
        return _nearby_response(NearbyResults(), response)

    # Round coordinates to 4 decimal places (~11 meters of precision) to hit cache for identical points
    cache_key = (round(lat, 4), round(lon, 4), max_travel_time_minutes, filter_key,
                 _walking_routing_enabled(), WALKING_BASE_URL)
    if cache_key in NEARBY_CACHE:
        return _nearby_response(NEARBY_CACHE[cache_key], response, cached=True)

    # Calculate travel distance limit: 4.8 km/h = 80 meters per minute
    radius = int(80.0 * max_travel_time_minutes)

    # Fetch custom query from DB if filter_key is provided
    osm_query = None
    google_type = None
    if filter_key:
        filter_obj = db.scalar(select(MapFilter).where(MapFilter.key == filter_key))
        if filter_obj:
            osm_query = filter_obj.osm_query
            google_type = filter_obj.google_type

    provider = os.getenv("PLACE_SEARCH_PROVIDER", "photon").lower()

    candidates = []
    if provider == "google":
        key = os.getenv("GOOGLE_PLACES_API_KEY")
        if not key:
            candidates = search_overpass_nearby(lat, lon, radius, osm_query, filter_key)
        else:
            candidates = search_google_nearby(lat, lon, radius, key, google_type, filter_key)
    else:
        candidates = search_overpass_nearby(lat, lon, radius, osm_query, filter_key)

    # Retain supplier status while the existing filtering/routing produces new lists.
    diagnostics = dict(provider=getattr(candidates, "provider", "google" if provider == "google" else "unknown"),
                       raw_count=getattr(candidates, "raw_count", len(candidates)),
                       limited=getattr(candidates, "limited", False),
                       reason=getattr(candidates, "reason", "unknown"))

    # Compute real walking times
    candidates = compute_real_walking_times(lat, lon, _unique_nearby(candidates))

    filtered_results = []
    for c in candidates:
        if c.estimated_minutes is not None:
            # Duration from the explicit pedestrian graph
            if c.estimated_minutes <= max_travel_time_minutes:
                filtered_results.append(c)
        else:
            # Straight-line prefilter only; duration remains unknown to the client
            if distance_meters(lat, lon, c.latitude, c.longitude) <= radius:
                filtered_results.append(c)

    filtered_results.sort(key=lambda x: (
        x.estimated_minutes is None, x.estimated_minutes if x.estimated_minutes is not None else math.inf,
        distance_meters(lat, lon, x.latitude, x.longitude), x.name.casefold()))
    res = NearbyResults(filtered_results[:50], **diagnostics, filtered_count=len(filtered_results))

    # Prevent memory leaks in the nearby cache, and only cache if we got successful recommendations (res is not empty)
    if len(res) > 0 and not res.limited and all(c.estimated_minutes is not None for c in res):
        if len(NEARBY_CACHE) > 200:
            NEARBY_CACHE.clear()
        NEARBY_CACHE[cache_key] = res

    return _nearby_response(res, response)

def search_overpass_nearby(lat: float, lon: float, radius: int, osm_query: Optional[str] = None, filter_key: Optional[str] = None):
    # Fetch the whole local inventory. A provider-side cap is by OSM ID, never by distance.
    # nwr: fetches Nodes, Ways, and Relations (supports polygon centers for large venues)
    # amenity regex filtering: extremely fast single-pass match
    # out center: computes gravity center coordinates for polygonal elements automatically
    
    # Sanitize osm_query to avoid Overpass QL syntax escape / injection
    if filter_key in (None, 'bar', 'food'):
        # Built-in filters used to be seeded with a narrower query than the parser.
        # Include cafes/restaurants with an explicit bar activity, beer gardens and clubs.
        query_body = 'nwr["amenity"~"^(pub|bar|biergarten|taphouse|nightclub|restaurant|cafe|fast_food|food_court)$"]'
    elif osm_query:
        cleaned = osm_query.strip()
        if re.match(r'^[a-zA-Z0-9_\[\]"\'=~^$|:\s\-]+$', cleaned) and not any(c in cleaned for c in (";", ")", "(")):
            query_body = cleaned
        else:
            query_body = 'nwr["amenity"~"^(pub|bar|restaurant)$"]'
    else:
        query_body = 'nwr["amenity"~"^(pub|bar|restaurant)$"]'
    
    overpass_query = f"""
    [out:json][timeout:2];
    (
      {query_body}["name"](around:{radius},{lat},{lon});
    );
    out center;
    """
    
    # At most one primary, one backup and one Photon call. No mirror fan-out/retry loop.
    servers = [
        "https://overpass.openstreetmap.fr/api/interpreter",
        "https://overpass-api.de/api/interpreter",
    ]
    data_encoded = urllib.parse.urlencode({"data": overpass_query}).encode("utf-8")
    deadline = time.monotonic() + 9
    res_data = None
    failure = "overpass_unavailable"
    for server in servers:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            data = _http_get_json(server, data_encoded=data_encoded,
                                  headers={"Content-Type": "application/x-www-form-urlencoded"},
                                  timeout=min(3, remaining))
            # Even an empty or warning-only partial response must not masquerade as complete.
            if isinstance(data, dict) and data.get("remark"):
                failure = "overpass_partial"
                logging.getLogger("uvicorn.error").info(
                    "places.provider provider=overpass raw=%d accepted=0 reason=partial",
                    len(data.get("elements", [])) if isinstance(data.get("elements"), list) else 0,
                )
                continue
            if isinstance(data, dict) and isinstance(data.get("elements"), list):
                res_data = data
                break
        except Exception:
            # Do not log provider URLs, queries or exception strings.
            continue

    def photon_fallback(reason):
        remaining = deadline - time.monotonic()
        if remaining > 0:
            try:
                fallback = search_photon(filter_key or "bar", lat, lon, filter_key or "bar",
                                         timeout=min(3, remaining))
                return NearbyResults(fallback, provider="photon",
                                     raw_count=getattr(fallback, "raw_count", len(fallback)),
                                     limited=True, reason=reason)
            except Exception:
                pass
        return NearbyResults(provider="none", limited=True, reason="providers_unavailable")

    if res_data is None:
        return photon_fallback(failure)

    try:
        results = []
        for element in res_data.get("elements", []):
            # 'lat' and 'lon' are root fields for Node elements, but reside in 'center' for Way or Relation elements
            el_lat = element.get("lat", element.get("center", {}).get("lat"))
            el_lon = element.get("lon", element.get("center", {}).get("lon"))
            tags = element.get("tags", {})
            name = tags.get("name")
            
            if el_lat is None or el_lon is None or not name:
                continue
            if (not isinstance(el_lat, (int, float)) or not isinstance(el_lon, (int, float)) or
                    not math.isfinite(el_lat) or not math.isfinite(el_lon) or
                    abs(el_lat) > 90 or abs(el_lon) > 180):
                continue
            if any(tags.get(key) == 'yes' for key in ('disused', 'abandoned', 'demolished')):
                continue
                
            amenity = tags.get("amenity", "")
            
            # Strict Bar vs Restaurant taxonomy
            is_bar = False
            if amenity in ["bar", "pub", "biergarten", "taphouse", "nightclub"]:
                is_bar = True
            elif amenity in ["restaurant", "cafe", "fast_food"]:
                # Tolerate only if there is explicit bar/brewery activity
                if (
                    tags.get("bar") == "yes"
                    or tags.get("brewery") in ["yes", "microbrewery"]
                    or tags.get("drink:beer") == "yes"
                    or tags.get("drink:alcohol") == "yes"
                ):
                    is_bar = True
            elif tags.get("bar") == "yes":
                is_bar = True

            computed_stop_type = "bar" if is_bar else "food"

            if filter_key:
                if filter_key == "bar" and not is_bar:
                    continue
                if filter_key == "food" and amenity not in ["restaurant", "cafe", "fast_food", "food_court"]:
                    continue
                stop_type = filter_key
            else:
                stop_type = computed_stop_type
            
            street_name = tags.get("addr:street") or tags.get("contact:street")
            number = tags.get("addr:housenumber") or tags.get("contact:housenumber")
            street = ' '.join(part for part in (number, street_name) if part) or None
            city = tags.get("addr:city")
            country = tags.get("addr:country")
            
            results.append(
                BarSearchResult(
                    name=name,
                    street=street,
                    city=city,
                    country=country,
                    latitude=el_lat,
                    longitude=el_lon,
                    stop_type=stop_type
                )
            )
        return NearbyResults(results, raw_count=len(res_data["elements"]))
    except Exception:
        return photon_fallback("overpass_invalid")

def search_google_nearby(lat: float, lon: float, radius: int, key: str, google_type: Optional[str] = None, filter_key: Optional[str] = None):
    query_params = {
        "location": f"{lat},{lon}",
        "radius": str(radius),
        "type": google_type or "bar",
        "key": key,
        "language": "fr"
    }
    
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?{urllib.parse.urlencode(query_params)}"
    
    try:
        data = _http_get_json(url, timeout=5)
            
        status_google = data.get("status")
        if status_google not in ["OK", "ZERO_RESULTS"]:
            raise Exception(f"Google API error status: {status_google}")
            
        results = []
        for result in data.get("results", []):
            loc = result.get("geometry", {}).get("location", {})
            lat_val = loc.get("lat")
            lon_val = loc.get("lng")
            
            if lat_val is None or lon_val is None or not result.get("name"):
                continue
                
            types = result.get("types", [])
            is_bar = "bar" in types or "night_club" in types
            
            if not is_bar and ("restaurant" in types or "cafe" in types or "food" in types):
                computed_stop_type = "food"
            else:
                computed_stop_type = "bar" if is_bar else "food"

            if filter_key:
                if filter_key == "bar" and not is_bar:
                    continue
                if filter_key == "food" and is_bar:
                    continue
                stop_type = filter_key if filter_key not in ["bar", "food"] else computed_stop_type
            else:
                stop_type = computed_stop_type
                
            vicinity = result.get("vicinity", "")
            
            results.append(
                BarSearchResult(
                    name=result.get("name"),
                    street=vicinity if vicinity else None,
                    city=None,
                    country=None,
                    latitude=lat_val,
                    longitude=lon_val,
                    stop_type=stop_type
                )
            )
        return results
    except Exception as e:
        return search_overpass_nearby(lat, lon, radius, None, filter_key)
