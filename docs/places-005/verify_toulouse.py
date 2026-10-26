"""Bounded, free OSM reproduction. Offline by default; --fetch archives one query.

Run from the repository root with backend/.venv/bin/python and PYTHONPATH=backend.
Never calls PubRush production, Google, or a routing provider.
"""
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
import urllib.parse
import urllib.request
from unittest.mock import Mock, patch

CENTER = (43.6070791, 1.4512943)  # OSM node/5289461810, Delirium Café
RADIUS = 1200
TITO_ID = 13198405230
QUERY = f'''[out:json][timeout:15];
nwr["amenity"~"^(pub|bar|restaurant)$"](around:{RADIUS},{CENTER[0]},{CENTER[1]});
out center;'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--server', choices=['fr', 'de'], default='fr')
    args = parser.parse_args()
    folder = Path(__file__).parent
    fixture = folder / 'toulouse-overpass.json'
    if args.fetch:
        url = ('https://overpass.openstreetmap.fr/api/interpreter' if args.server == 'fr'
               else 'https://overpass-api.de/api/interpreter')
        req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': QUERY}).encode(),
                                     headers={'User-Agent': 'PubRush-PLACES-005/1.0 (+https://pubrush.com)'})
        raw = urllib.request.urlopen(req, timeout=20).read()
        data = json.loads(raw)
        if 'elements' not in data or data.get('remark'):
            raise RuntimeError('Incomplete Overpass response; fixture not replaced')
        fixture.write_bytes(raw)
        (folder / 'request.json').write_text(json.dumps({
            'url': url, 'query': QUERY, 'fetched_at': datetime.now(timezone.utc).isoformat(),
            'sha256': hashlib.sha256(raw).hexdigest(),
            'osm_base': data.get('osm3s', {}).get('timestamp_osm_base'),
            'attribution': '© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright',
        }, indent=2) + '\n')
    data = json.loads(fixture.read_text())
    elements = data['elements']
    target_index = next(i for i, e in enumerate(elements) if e['id'] == TITO_ID)
    assert target_index >= 50, 'The live dataset changed; reassess the old-cap reproduction'
    assert TITO_ID not in [e['id'] for e in elements[:50]]
    from app.api.routes import bars
    bars.NEARBY_CACHE.clear()
    # Replay the archived response through the real parser, sorting and endpoint logic.
    with patch.object(bars, '_http_get_json', return_value=data), \
         patch.object(bars, '_walking_routing_enabled', return_value=False):
        results = bars.get_nearby_bars(*CENTER, 15, 'bar', db=Mock(scalar=Mock(return_value=None)), current_user=None)
    target = next(r for r in results if 'Mojito' in r.name and r.street == '51 Allées Jean Jaurès')
    assert results.index(target) < 5
    assert target.estimated_minutes is None
    old_bar_elements = [e for e in elements if e.get('tags', {}).get('amenity') in ('pub', 'bar')]
    old_bar_position = next(i for i, e in enumerate(old_bar_elements) if e['id'] == TITO_ID) + 1
    assert old_bar_position > 50
    print(json.dumps({'raw_count': len(elements), 'old_position': target_index + 1,
                      'old_seeded_bar_position': old_bar_position,
                      'new_bar_position': results.index(target) + 1,
                      'result': target.model_dump()}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
