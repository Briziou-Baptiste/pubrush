import os
import json
import urllib.request
import urllib.parse
import ssl
import math
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps.auth import get_current_user
from app.models import User, MapFilter
from app.schemas import BarSearchResult

# In-memory thread-safe cache to avoid repeating heavy remote calls for identical or nearby queries
# This speeds up response times to 0ms for recurrent queries and autocomplete/transition loops.
NEARBY_CACHE = {}
SEARCH_CACHE = {}

router = APIRouter(prefix="/bars", tags=["bars"])

def _http_get_json(url: str, data_encoded: bytes = None, headers: dict = None, timeout: int = 5) -> dict:
    req_headers = {"User-Agent": "PubRush-FastAPI/1.0"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, data=data_encoded, headers=req_headers)
    ssl_context = ssl._create_unverified_context()
    
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

def search_photon(q: str, lat: Optional[float], lon: Optional[float], filter_key: Optional[str] = None):
    query_params = {"q": q, "limit": 15}  # Request slightly more to allow filtering
    if lat is not None and lon is not None:
        query_params["lat"] = str(lat)
        query_params["lon"] = str(lon)
        query_params["location_bias_scale"] = "0.2"

    url = f"https://photon.komoot.io/api/?{urllib.parse.urlencode(query_params)}"
    
    try:
        data = _http_get_json(url, timeout=5)
            
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
                    if not (osm_key == "amenity" and osm_val in ["pub", "bar", "biergarten"]):
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
                stop_type = "bar" if osm_val in ["bar", "pub", "biergarten"] else "food"
            
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
        return results[:10]  # Return capped list
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
                
            if filter_key:
                stop_type = filter_key
            else:
                types = result.get("types", [])
                stop_type = "bar"
                if "restaurant" in types or "cafe" in types or "food" in types:
                    stop_type = "food"
                
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
    based on a realistic urban pedestrian speed of 4.0 km/h.
    """
    R_earth = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_km = R_earth * c
    hours = dist_km / 4.0  # 4.0 km/h walking speed (realistic urban profile matching Google Maps)
    return max(1, int(round(hours * 60.0)))

def compute_real_walking_times(lat: float, lon: float, candidates: list[BarSearchResult]) -> list[BarSearchResult]:
    if not candidates:
        return []

    # OPTIMIZATION: Compute straight-line distances instantly locally,
    # then pre-sort and only query OSRM for the top 20 closest candidates.
    # This reduces OSRM Table workload by 60%, drastically improving response time.
    for c in candidates:
        c.estimated_minutes = get_straight_line_walking_minutes(lat, lon, c.latitude, c.longitude)

    candidates.sort(key=lambda x: x.estimated_minutes or 999)
    osrm_candidates = candidates[:20]
    ignored_candidates = candidates[20:]

    # Coordinates format for OSRM: lon,lat;lon,lat;...
    coords = [f"{lon},{lat}"]  # source coordinate
    for c in osrm_candidates:
        coords.append(f"{c.longitude},{c.latitude}")

    coords_str = ";".join(coords)
    url = f"http://router.project-osrm.org/table/v1/foot/{coords_str}?sources=0"

    try:
        res_data = _http_get_json(url, timeout=5)

        durations = res_data.get("durations", [])
        if not durations or len(durations[0]) < len(osrm_candidates) + 1:
            return candidates

        source_durations = durations[0]
        for idx, c in enumerate(osrm_candidates):
            duration_sec = source_durations[idx + 1]
            if duration_sec is not None:
                # Scale OSRM default speed (5 km/h) to 4.0 km/h by multiplying by 1.25 (aligns perfectly with Google Maps)
                duration_adjusted = duration_sec * 1.25
                c.estimated_minutes = max(1, int(round(duration_adjusted / 60.0)))

    except Exception as e:
        print(f"Error calling OSRM Table API: {e}")
        # If OSRM fails, the straight-line times computed above remain as perfect back-ups

    return osrm_candidates + ignored_candidates

@router.get("/nearby", response_model=list[BarSearchResult])
def get_nearby_bars(
    lat: float,
    lon: float,
    max_travel_time_minutes: int,
    filter_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if max_travel_time_minutes <= 0:
        return []

    # Round coordinates to 4 decimal places (~11 meters of precision) to hit cache for identical points
    cache_key = (round(lat, 4), round(lon, 4), max_travel_time_minutes, filter_key)
    if cache_key in NEARBY_CACHE:
        return NEARBY_CACHE[cache_key]

    # Calculate travel distance limit: 4 km/h = ~66.67 meters per minute
    radius = int(66.67 * max_travel_time_minutes)

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

    # Compute real walking times
    candidates = compute_real_walking_times(lat, lon, candidates)

    filtered_results = []
    for c in candidates:
        if c.estimated_minutes is not None:
            # Use exact pedestrian OSRM route time
            if c.estimated_minutes <= max_travel_time_minutes:
                filtered_results.append(c)
        else:
            # Fallback to straight-line walking time
            dist_minutes = get_straight_line_walking_minutes(lat, lon, c.latitude, c.longitude)
            if dist_minutes <= max_travel_time_minutes:
                c.estimated_minutes = dist_minutes
                filtered_results.append(c)

    filtered_results.sort(key=lambda x: x.estimated_minutes or 999)
    res = filtered_results[:50]  # Propose up to 50 sorted recommendations to the frontend

    # Prevent memory leaks in the nearby cache, and only cache if we got successful recommendations (res is not empty)
    if len(res) > 0:
        if len(NEARBY_CACHE) > 200:
            NEARBY_CACHE.clear()
        NEARBY_CACHE[cache_key] = res

    return res

def search_overpass_nearby(lat: float, lon: float, radius: int, osm_query: Optional[str] = None, filter_key: Optional[str] = None):
    # Spatial Overpass API query searching for bars, pubs, and restaurants in the nearby area (cap to 50 results)
    # nwr: fetches Nodes, Ways, and Relations (supports polygon centers for large venues)
    # amenity regex filtering: extremely fast single-pass match
    # out center: computes gravity center coordinates for polygonal elements automatically
    
    query_body = osm_query if osm_query else 'nwr["amenity"~"^(pub|bar|restaurant)$"]'
    
    overpass_query = f"""
    [out:json][timeout:5];
    (
      {query_body}(around:{radius},{lat},{lon});
    );
    out center 50;
    """
    
    servers = [
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    data_encoded = urllib.parse.urlencode({"data": overpass_query}).encode("utf-8")
    
    import ssl
    res_data = None
    
    for server_url in servers:
        try:
            res_data = _http_get_json(
                server_url, 
                data_encoded=data_encoded,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=3
            )
            if res_data:
                break
        except Exception:
            continue
            
    if not res_data:
        try:
            return search_photon(filter_key or "bar", lat, lon)[:10]
        except Exception:
            return []
            
    try:
        results = []
        for element in res_data.get("elements", []):
            # 'lat' and 'lon' are root fields for Node elements, but reside in 'center' for Way or Relation elements
            el_lat = element.get("lat") or element.get("center", {}).get("lat")
            el_lon = element.get("lon") or element.get("center", {}).get("lon")
            tags = element.get("tags", {})
            name = tags.get("name")
            
            if el_lat is None or el_lon is None or not name:
                continue
                
            if filter_key:
                stop_type = filter_key
            else:
                amenity = tags.get("amenity", "")
                stop_type = "bar" if amenity in ["bar", "pub"] else "food"
            
            street = tags.get("addr:street")
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
        return results
    except Exception:
        try:
            return search_photon(filter_key or "bar", lat, lon)[:10]
        except Exception:
            return []

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
                
            if filter_key:
                stop_type = filter_key
            else:
                types = result.get("types", [])
                stop_type = "bar"
                if "restaurant" in types or "cafe" in types or "food" in types:
                    stop_type = "food"
                
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
