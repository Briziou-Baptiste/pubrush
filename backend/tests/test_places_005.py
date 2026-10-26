import json
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from app.api.routes import bars
from app.models import MapFilter

CENTER = (43.6070791, 1.4512943)
FIXTURE = Path(__file__).resolve().parents[2] / 'docs/places-005/toulouse-overpass.json'


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setenv('PLACE_SEARCH_PROVIDER', 'photon')
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setenv('WALKING_ROUTING_ENABLED', 'true')  # production still forbids the demo
    bars.NEARBY_CACHE.clear()
    bars.SEARCH_CACHE.clear()
    yield
    bars.NEARBY_CACHE.clear()
    bars.SEARCH_CACHE.clear()


def nearby(client, headers, filter_key='bar'):
    return client.get('/bars/nearby', params={
        'lat': CENTER[0], 'lon': CENTER[1], 'max_travel_time_minutes': 15,
        'filter_key': filter_key,
    }, headers=headers)


def node(name, lat, lon, amenity='bar', **tags):
    return {'lat': lat, 'lon': lon, 'tags': {'name': name, 'amenity': amenity, **tags}}


@patch.object(bars, '_http_get_json')
def test_archived_toulouse_missing_bar_is_recovered(mock, client, user_auth_headers, db_session):
    data = json.loads(FIXTURE.read_text())
    old_bars = [e for e in data['elements'] if e['tags']['amenity'] in ('pub', 'bar')]
    assert next(i for i, e in enumerate(old_bars) if e['id'] == 13198405230) == 132
    mock.return_value = data
    # Exercise the narrow global filter as seeded in the existing database.
    db_session.add(MapFilter(key='bar', label='Bars', icon='beer',
                             osm_query='nwr["amenity"~"^(pub|bar)$"]', google_type='bar', is_global=True))
    db_session.commit()
    response = nearby(client, user_auth_headers)
    assert response.status_code == 200
    results = response.json()
    assert results[0]['name'] == 'Delirium Café'
    assert results[1]['name'] == 'El Tío Mojito'
    assert results[1]['street'] == '51 Allées Jean Jaurès'
    assert all(r['estimated_minutes'] is None for r in results)
    assert mock.call_count == 1  # no routing, no paid provider
    query = parse_qs(mock.call_args.kwargs['data_encoded'].decode())['data'][0]
    assert 'out center;' in query
    assert 'out center 50' not in query
    assert '["name"]' in query


@patch.object(bars, '_http_get_json')
def test_limit_after_classification_dedup_and_distance_sort(mock, client, user_auth_headers):
    # The closest venue is after 60 distant bars and unnamed records in OSM order.
    elements = [node(f'Far {i}', CENTER[0] + .006, CENTER[1] + i * .00001) for i in range(60)]
    elements += [node('', *CENTER), node('Nearest', CENTER[0] + .0001, CENTER[1])]
    elements += [node('Nearest', CENTER[0] + .00011, CENTER[1]),
                 node('Distinct neighbour', CENTER[0] + .00012, CENTER[1]),
                 node('Nearest', CENTER[0] + .003, CENTER[1]),
                 node('Outside radius', CENTER[0] + .02, CENTER[1])]
    mock.return_value = {'elements': elements}
    results = nearby(client, user_auth_headers).json()
    assert len(results) == 50
    assert [r['name'] for r in results[:3]] == ['Nearest', 'Distinct neighbour', 'Nearest']
    assert 'Outside radius' not in [r['name'] for r in results]


@patch.object(bars, '_http_get_json')
def test_mixed_venues_and_custom_filters(mock):
    mock.return_value = {'elements': [
        node('Cafe bar', *CENTER, 'cafe', bar='yes'),
        node('Restaurant bar', *CENTER, 'restaurant', bar='yes'),
        node('Plain restaurant', *CENTER, 'restaurant'),
        node('Beer garden', *CENTER, 'biergarten'),
        node('Closed', *CENTER, disused='yes'),
    ]}
    result = bars.search_overpass_nearby(*CENTER, 1200, filter_key='bar')
    assert [r.name for r in result] == ['Cafe bar', 'Restaurant bar', 'Beer garden']
    result = bars.search_overpass_nearby(*CENTER, 1200, filter_key='food')
    assert [r.name for r in result] == ['Cafe bar', 'Restaurant bar', 'Plain restaurant']
    assert all(r.stop_type == 'food' for r in result)
    bars.search_overpass_nearby(*CENTER, 1200, 'nwr["amenity"="hospital"]', 'first_aid')
    query = parse_qs(mock.call_args.kwargs['data_encoded'].decode())['data'][0]
    assert 'hospital' in query
    assert 'biergarten' not in query


@patch.object(bars, '_http_get_json')
def test_photon_filters_before_provider_limit(mock):
    mock.return_value = {'features': []}
    bars.search_photon('mojito', *CENTER, 'bar')
    params = parse_qs(urlparse(mock.call_args.args[0]).query)
    assert params['osm_tag'] == ['amenity:pub', 'amenity:bar', 'amenity:biergarten', 'amenity:nightclub']
    assert params['lat'] == [str(CENTER[0])]
    assert params['lon'] == [str(CENTER[1])]
