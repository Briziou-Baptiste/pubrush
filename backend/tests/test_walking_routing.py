from unittest.mock import patch
import pytest
from app.api.routes import bars
from app.schemas import BarSearchResult

@pytest.fixture(autouse=True)
def clean_routing_cache(monkeypatch):
    monkeypatch.setenv("WALKING_ROUTING_ENABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "test")
    bars._walking_next_request_at = 0
    bars.NEARBY_CACHE.clear()
    yield
    bars._walking_next_request_at = 0
    bars.NEARBY_CACHE.clear()

def candidates(count=2):
    return [BarSearchResult(name=f'Bar {i}', latitude=43.6027 + i / 10000, longitude=1.4411, stop_type='bar') for i in range(count)]

@patch.object(bars, '_http_get_json')
def test_explicit_pedestrian_matrix_all_candidates(mock):
    mock.return_value = {'code': 'Ok', 'durations': [[0] + [289.6] * 25]}
    result = bars.compute_real_walking_times(43.6045, 1.444, candidates(25))
    assert len(result) == 25
    assert all(c.estimated_minutes == 5 for c in result)
    url = mock.call_args.args[0]
    assert url.startswith('https://routing.openstreetmap.de/routed-foot/table/v1/foot/1.444,43.6045;')
    assert url.count('75') == 26

@patch.object(bars, '_http_get_json')
def test_unreachable_has_no_haversine_replacement(mock):
    mock.return_value = {'code': 'Ok', 'durations': [[0, None, 600]]}
    result = bars.compute_real_walking_times(43.6045, 1.444, candidates())
    assert [(c.name, c.estimated_minutes) for c in result] == [('Bar 1', 10)]

@pytest.mark.parametrize('data', [{}, {'code': 'NoTable'}, {'code': 'Ok', 'durations': [[0]]},
    {'code': 'Ok', 'durations': [[0, -1, 60]]}, {'code': 'Ok', 'durations': [[0, float('nan'), 60]]},
    {'code': 'Ok', 'durations': [[0, '60', 60]]}])
@patch.object(bars, '_http_get_json')
def test_malformed_matrix_stays_unknown(mock, data):
    mock.return_value = data
    assert all(c.estimated_minutes is None for c in bars.compute_real_walking_times(43.6045, 1.444, candidates()))

@patch.object(bars, '_http_get_json', side_effect=TimeoutError)
def test_provider_failure_stays_unknown_and_is_retried(mock):
    assert all(c.estimated_minutes is None for c in bars.compute_real_walking_times(43.6045, 1.444, candidates()))
    bars._walking_next_request_at = 0
    bars.compute_real_walking_times(43.6045, 1.444, candidates())
    assert mock.call_count == 2

@patch.object(bars, '_http_get_json', return_value={'code': 'Ok', 'durations': [[0, 60, 60]]})
def test_admission_limit(mock):
    with patch.object(bars.time, 'monotonic', return_value=100):
        bars.compute_real_walking_times(43.6045, 1.444, candidates())
        result = bars.compute_real_walking_times(43.6045, 1.444, candidates())
    assert mock.call_count == 1
    assert all(c.estimated_minutes is None for c in result)

@patch.object(bars, 'search_overpass_nearby')
@patch.object(bars, '_http_get_json', side_effect=TimeoutError)
def test_nearby_failure_not_cached(mock_http, mock_search, client, user_auth_headers):
    mock_search.side_effect = lambda *args: candidates()
    url = '/bars/nearby?lat=43.6045&lon=1.444&max_travel_time_minutes=15'
    for _ in range(2):
        bars._walking_next_request_at = 0
        response = client.get(url, headers=user_auth_headers)
        assert response.status_code == 200
        assert all(c['estimated_minutes'] is None for c in response.json())
    assert mock_http.call_count == 2
    assert len(bars.NEARBY_CACHE) == 0


@patch.object(bars, '_http_get_json')
def test_provider_disabled_by_default(mock, monkeypatch):
    monkeypatch.delenv('WALKING_ROUTING_ENABLED')
    result = bars.compute_real_walking_times(43.6045, 1.444, candidates())
    assert all(c.estimated_minutes is None for c in result)
    mock.assert_not_called()

# PLACES-003: production and the disabled path must be independent of the demo.
@patch.object(bars, '_http_get_json')
def test_production_rejects_inherited_demo_flag(mock, monkeypatch):
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setenv('WALKING_ROUTING_ENABLED', 'true')
    result = bars.compute_real_walking_times(43.6045, 1.444, candidates())
    assert all(c.estimated_minutes is None for c in result)
    mock.assert_not_called()

@patch.object(bars, 'search_overpass_nearby')
@patch.object(bars, '_http_get_json')
def test_disabled_nearby_cannot_reuse_enabled_cache(mock_http, mock_search, client, user_auth_headers, monkeypatch):
    mock_search.side_effect = lambda *args: candidates()
    mock_http.return_value = {'code': 'Ok', 'durations': [[0, 60, 60]]}
    url = '/bars/nearby?lat=43.6045&lon=1.444&max_travel_time_minutes=15'
    warm = client.get(url, headers=user_auth_headers)
    assert warm.status_code == 200
    assert all(c['estimated_minutes'] == 1 for c in warm.json())
    assert len(bars.NEARBY_CACHE) == 1
    monkeypatch.delenv('WALKING_ROUTING_ENABLED')
    cold = client.get(url, headers=user_auth_headers)
    assert cold.status_code == 200
    assert len(cold.json()) == 2
    assert all(c['estimated_minutes'] is None for c in cold.json())
    assert mock_search.call_count == 2
    assert mock_http.call_count == 1

@pytest.mark.parametrize('enabled', [False, True], ids=['disabled', 'provider-timeout'])
@patch.object(bars, 'search_overpass_nearby')
@patch.object(bars, '_http_get_json', side_effect=TimeoutError)
def test_create_barathon_without_walking_provider(mock_http, mock_search, enabled, client, user_auth_headers, test_user_2, monkeypatch):
    from datetime import datetime, timedelta
    monkeypatch.setenv('WALKING_ROUTING_ENABLED', 'true' if enabled else 'false')
    mock_search.side_effect = lambda *args: candidates()
    nearby = client.get('/bars/nearby?lat=43.6045&lon=1.444&max_travel_time_minutes=15', headers=user_auth_headers)
    assert nearby.status_code == 200
    assert len(nearby.json()) == 2
    assert all(c['estimated_minutes'] is None for c in nearby.json())
    now = datetime.utcnow() + timedelta(days=1)
    response = client.post('/barathons', headers=user_auth_headers, json={
        'name': 'PLACES-003 fallback', 'start_datetime': now.isoformat(),
        'end_datetime': (now + timedelta(hours=3)).isoformat(),
        'travel_time_between_bars_minutes': 15, 'max_time_in_bar_minutes': 45,
        'participant_user_ids': [test_user_2.id],
        'stops': [{'name': c['name'], 'stop_type': c['stop_type'],
                   'latitude': c['latitude'], 'longitude': c['longitude'], 'stop_order': i + 1}
                  for i, c in enumerate(nearby.json())],
    })
    assert response.status_code == 201
    assert [(s['name'], s['stop_order']) for s in response.json()['stops']] == [
        (candidate['name'], i + 1) for i, candidate in enumerate(nearby.json())]
    assert mock_http.call_count == (1 if enabled else 0)
