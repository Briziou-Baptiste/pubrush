import pytest
import json
from unittest.mock import patch, MagicMock

@patch("urllib.request.urlopen")
def test_search_bars_photon_fallback(mock_urlopen, client, user_auth_headers):
    # 1. Setup mock response for Photon API call
    mock_response = MagicMock()
    photon_data = {
        "features": [
            {
                "geometry": {
                    "coordinates": [2.3412, 48.8601]
                },
                "properties": {
                    "name": "Le Délirium Café",
                    "street": "Rue Clément",
                    "city": "Paris",
                    "country": "France",
                    "osm_value": "pub"
                }
            }
        ]
    }
    mock_response.read.return_value = json.dumps(photon_data).encode("utf-8")
    mock_response.__enter__.return_value = mock_response
    mock_urlopen.return_value = mock_response

    # 2. Call search endpoint (q must be at least 2 chars long)
    response = client.get("/bars/search?q=delirium", headers=user_auth_headers)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["name"] == "Le Délirium Café"
    assert results[0]["latitude"] == 48.8601
    assert results[0]["longitude"] == 2.3412
    assert results[0]["stop_type"] == "bar"

@patch("urllib.request.urlopen")
def test_get_nearby_bars_overpass(mock_urlopen, client, user_auth_headers):
    # We have two API calls in get_nearby_bars:
    # 1. Overpass API call to retrieve candidates
    # 2. OSRM API call (compute_real_walking_times) to compute routing times

    overpass_data = {
        "elements": [
            {
                "type": "node",
                "id": 111,
                "lat": 48.8566,
                "lon": 2.3522,
                "tags": {
                    "name": "Le Bar Central",
                    "amenity": "bar",
                    "addr:street": "Rue de Rivoli",
                    "addr:city": "Paris",
                    "addr:country": "France"
                }
            }
        ]
    }
    
    osrm_data = {
        "durations": [
            [0, 120]  # Source to source = 0s, source to Le Bar Central = 120s (2 mins)
        ]
    }

    # Setup the mock urlopen to return Overpass first, then OSRM
    mock_response_overpass = MagicMock()
    mock_response_overpass.read.return_value = json.dumps(overpass_data).encode("utf-8")
    mock_response_overpass.__enter__.return_value = mock_response_overpass

    mock_response_osrm = MagicMock()
    mock_response_osrm.read.return_value = json.dumps(osrm_data).encode("utf-8")
    mock_response_osrm.__enter__.return_value = mock_response_osrm

    # Side effect returns Overpass response first, then OSRM response
    mock_urlopen.side_effect = [mock_response_overpass, mock_response_osrm]

    # Call nearby endpoint
    response = client.get("/bars/nearby?lat=48.8565&lon=2.3521&max_travel_time_minutes=15", headers=user_auth_headers)
    assert response.status_code == 200
    results = response.json()
    
    assert len(results) == 1
    assert results[0]["name"] == "Le Bar Central"
    assert results[0]["estimated_minutes"] == 2 # 120s * 1.25 = 150s -> 2.5 mins -> rounds to 2 (banker's rounding)
