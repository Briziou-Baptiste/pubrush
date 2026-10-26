"""Offline supplier replay: public Tito Mojito Merly, never a user GPS trace."""
import json
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs

import pytest
from app.api.routes import bars

FIXTURES = Path(__file__).resolve().parents[2] / 'docs/places-008'
CENTER = (43.6100825, 1.4429057)
NORMAL = json.loads((FIXTURES / 'tito-merly-overpass.json').read_text())
PHOTON = json.loads((FIXTURES / 'tito-merly-photon.json').read_text())
PARTIAL = {'elements': NORMAL['elements'][:3], 'remark': 'runtime error: Query timed out'}


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setenv('PLACE_SEARCH_PROVIDER', 'photon')
    monkeypatch.setenv('WALKING_ROUTING_ENABLED', 'true')
    bars.NEARBY_CACHE.clear()
    yield
    bars.NEARBY_CACHE.clear()


def nearby(client, headers):
    return client.get('/bars/nearby', params={'lat': CENTER[0], 'lon': CENTER[1],
                      'max_travel_time_minutes': 12, 'filter_key': 'bar'}, headers=headers)


@patch.object(bars, '_http_get_json', return_value=NORMAL)
def test_tito_full_chain_counts_and_compatible_list(http, client, user_auth_headers, caplog):
    with caplog.at_level('INFO', logger='uvicorn.error'):
        response = nearby(client, user_auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 50
    assert response.json()[0]['name'] == 'Tito Mojito'
    assert response.headers['X-Places-Provider'] == 'overpass'
    assert response.headers['X-Places-Raw-Count'] == '673'
    assert response.headers['X-Places-Filtered-Count'] == '116'
    assert response.headers['X-Places-Returned-Count'] == '50'
    assert response.headers['X-Places-Limited'] == 'false'
    assert http.call_count == 1
    query = parse_qs(http.call_args.kwargs['data_encoded'].decode())['data'][0]
    assert 'out center;' in query and 'out center 50' not in query
    assert '(around:960,43.6100825,1.4429057)' in query
    assert len(bars.NEARBY_CACHE) == 0
    diagnostic = '\n'.join(r.message for r in caplog.records if r.message.startswith('places.'))
    for forbidden in ['43.6100825', '1.4429057', 'Tito', 'Bearer', 'testuser']:
        assert forbidden not in diagnostic
    assert 'raw=673 filtered=116 returned=50' in diagnostic


@patch.object(bars, '_http_get_json', return_value={'elements': []})
def test_empty_complete_inventory_does_not_trigger_fallback(http, client, user_auth_headers):
    response = nearby(client, user_auth_headers)
    assert response.json() == []
    assert response.headers['X-Places-Limited'] == 'false'
    assert response.headers['X-Places-Provider'] == 'overpass'
    assert http.call_count == 1


@patch.object(bars, '_http_get_json', side_effect=[PARTIAL, NORMAL])
def test_partial_primary_is_discarded_complete_backup_wins(http):
    result = bars.search_overpass_nearby(*CENTER, 960, filter_key='bar')
    assert len(result) == 117
    assert result.raw_count == 673 and not result.limited
    assert http.call_count == 2
    assert 'overpass.openstreetmap.fr' in http.call_args_list[0].args[0]
    assert 'overpass-api.de' in http.call_args_list[1].args[0]


@pytest.mark.parametrize('primary,secondary,reason', [
    (PARTIAL, PARTIAL, 'overpass_partial'),
    (TimeoutError('secret-provider-detail'), TimeoutError(), 'overpass_unavailable'),
    ({'invalid': 'format'}, {'elements': None}, 'overpass_unavailable'),
])
def test_fallback_photon_is_flagged_and_geofiltered(primary, secondary, reason, client, user_auth_headers, caplog):
    with patch.object(bars, '_http_get_json', side_effect=[primary, secondary, PHOTON]) as http:
        with caplog.at_level('INFO', logger='uvicorn.error'):
            response = nearby(client, user_auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 3
    assert response.headers['X-Places-Provider'] == 'photon'
    assert response.headers['X-Places-Raw-Count'] == '15'
    assert response.headers['X-Places-Filtered-Count'] == '3'
    assert response.headers['X-Places-Limited'] == 'true'
    assert response.headers['X-Places-Reason'] == reason
    assert http.call_count == 3
    assert all(0 < c.kwargs['timeout'] <= 6 for c in http.call_args_list)
    assert http.call_args_list[0].kwargs['timeout'] > 3  # Primary mirror allows queries taking > 3s
    assert 'secret-provider-detail' not in caplog.text
    assert len(bars.NEARBY_CACHE) == 0


@patch.object(bars, '_http_get_json', side_effect=TimeoutError('secret-provider-detail'))
def test_all_providers_fail_returns_limited_not_empty_complete(http, client, user_auth_headers):
    response = nearby(client, user_auth_headers)
    assert response.json() == []
    assert response.headers['X-Places-Provider'] == 'none'
    assert response.headers['X-Places-Limited'] == 'true'
    assert response.headers['X-Places-Reason'] == 'providers_unavailable'
    assert http.call_count == 3


def test_expired_budget_never_starts_extra_supplier_calls():
    with patch.object(bars.time, 'monotonic', side_effect=[0, 0, 10, 10]), \
         patch.object(bars, '_http_get_json', side_effect=TimeoutError()) as http:
        result = bars.search_overpass_nearby(*CENTER, 960, filter_key='bar')
    assert http.call_count == 1
    assert result == [] and result.limited and result.provider == 'none'


def test_invalid_elements_cannot_leak_partial_parser_results():
    invalid = {'elements': [NORMAL['elements'][0], None]}
    with patch.object(bars, '_http_get_json', side_effect=[invalid, PHOTON]) as http:
        result = bars.search_overpass_nearby(*CENTER, 960, filter_key='bar')
    assert http.call_count == 2
    assert result.provider == 'photon' and result.limited
    assert result.reason == 'overpass_invalid'


def test_hotfix_011_primary_timeout_allows_queries_longer_than_three_seconds(client, user_auth_headers):
    """HOTFIX-011: Overpass queries taking >3s must not be killed by a 3s socket timeout."""
    with patch.object(bars, '_http_get_json', return_value=NORMAL) as http:
        response = nearby(client, user_auth_headers)
    assert response.status_code == 200
    assert response.headers['X-Places-Provider'] == 'overpass'
    assert response.headers['X-Places-Returned-Count'] == '50'
    assert response.headers['X-Places-Limited'] == 'false'
    primary_timeout = http.call_args_list[0].kwargs['timeout']
    assert primary_timeout >= 5.0, f"Primary timeout {primary_timeout} should be >= 5.0s to allow realistic Overpass queries"
    query = parse_qs(http.call_args_list[0].kwargs['data_encoded'].decode())['data'][0]
    assert '[timeout:6];' in query, "Overpass QL timeout must be at least 6s"


def test_hotfix_011_retry_recovers_to_full_inventory(client, user_auth_headers):
    """HOTFIX-011: A failed request falls back to Photon (3 bars, limited=True, uncached),
    and a subsequent retry when Overpass responds successfully recovers 50 bars (limited=false)."""
    # Attempt 1: Overpass mirrors fail -> falls back to Photon (3 bars)
    with patch.object(bars, '_http_get_json', side_effect=[TimeoutError(), TimeoutError(), PHOTON]):
        resp1 = nearby(client, user_auth_headers)
    assert resp1.status_code == 200
    assert len(resp1.json()) == 3
    assert resp1.headers['X-Places-Provider'] == 'photon'
    assert resp1.headers['X-Places-Limited'] == 'true'
    # Uncached: memory cache must not store limited result
    assert len(bars.NEARBY_CACHE) == 0

    # Attempt 2 (user presses 'Relancer'): Overpass succeeds -> full 50 bars returned
    with patch.object(bars, '_http_get_json', return_value=NORMAL):
        resp2 = nearby(client, user_auth_headers)
    assert resp2.status_code == 200
    assert len(resp2.json()) == 50
    assert resp2.headers['X-Places-Provider'] == 'overpass'
    assert resp2.headers['X-Places-Limited'] == 'false'

