"""Offline replay only. Run at repo root: PYTHONPATH=backend backend/.venv/bin/python docs/places-008/replay.py."""
import json
from pathlib import Path
from unittest.mock import Mock, patch
from app.api.routes import bars

folder = Path(__file__).parent
normal = json.loads((folder / 'tito-merly-overpass.json').read_text())
photon = json.loads((folder / 'tito-merly-photon.json').read_text())
center = (43.6100825, 1.4429057)  # public OSM node 7700449713
partial = {'elements': normal['elements'][:3], 'remark': 'runtime error: Query timed out'}
report = {}
for name, responses in [('normal', [normal]), ('partial_recovered', [partial, normal]),
                         ('photon_limited', [partial, partial, photon])]:
    bars.NEARBY_CACHE.clear()
    with patch.object(bars, '_http_get_json', side_effect=responses) as http, \
         patch.object(bars, '_walking_routing_enabled', return_value=False):
        results = bars.get_nearby_bars(*center, 12, 'bar', db=Mock(scalar=Mock(return_value=None)), current_user=None)
    report[name] = {'provider': results.provider, 'raw': results.raw_count,
                    'filtered': results.filtered_count, 'returned': len(results),
                    'limited': results.limited, 'reason': results.reason,
                    'supplier_calls_mocked': http.call_count,
                    'items': [r.model_dump() for r in results]}
(folder / 'replay.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({name: {k: v for k, v in result.items() if k != 'items'} for name, result in report.items()}, indent=2))
