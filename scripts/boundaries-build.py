"""Rebuild/validate Kota Bekasi map boundaries from the retained government snapshot.

Requires Python 3.10+ and Shapely 2.x. See docs/boundaries.md for provenance.
Default is offline; --download deliberately refreshes the upstream snapshot.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--download", action="store_true", help="Refresh public source geometry")
parser.add_argument("--check", action="store_true", help="Validate existing output without modifying it")
parser.add_argument("--dependency-path", help="Optional location of a temporary Shapely installation")
args = parser.parse_args()
if args.dependency_path:
    sys.path.insert(0, args.dependency_path)

from shapely.geometry import mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "scripts/boundaries-source.geojson"
SOURCE = "https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0"
QUERY = {
    "where": "kdpkab='32.75'",
    "outFields": "objectid,namobj,wadmkc,wadmkk,kdcpum,kdpkab",
    "returnGeometry": "true",
    "returnZ": "false",
    "outSR": "4326",
    "f": "geojson",
}
NAMES = {
    "32.75.01": "Bekasi Timur",
    "32.75.02": "Bekasi Barat",
    "32.75.03": "Bekasi Utara",
    "32.75.04": "Bekasi Selatan",
    "32.75.05": "Rawalumbu",
    "32.75.06": "Medan Satria",
    "32.75.07": "Bantargebang",
    "32.75.08": "Pondok Gede",
    "32.75.09": "Jatiasih",
    "32.75.10": "Jatisampurna",
    "32.75.11": "Mustikajaya",
    "32.75.12": "Pondok Melati",
}

if args.download:
    if args.check:
        parser.error("--download cannot be combined with --check")
    with urlopen(f"{SOURCE}/query?{urlencode(QUERY)}", timeout=60) as response:
        source_bytes = response.read()
    candidate = json.loads(source_bytes)
    assert candidate.get("type") == "FeatureCollection", "Upstream did not return GeoJSON"
    assert len(candidate.get("features", [])) == 56, "Upstream village count changed; review before updating"
    SOURCE_FILE.write_bytes(source_bytes)

source_bytes = SOURCE_FILE.read_bytes()
source = json.loads(source_bytes)
assert source["type"] == "FeatureCollection"
assert len(source["features"]) == 56
assert not source.get("exceededTransferLimit"), "Upstream response was truncated"
groups = {code: [] for code in NAMES}
source_names = {}
village_ids = set()
for feature in source["features"]:
    props = feature["properties"]
    assert props["kdpkab"] == "32.75" and props["wadmkk"] == "Kota Bekasi"
    code = props["kdcpum"]
    assert code in NAMES, f"Unexpected kecamatan: {code}"
    geometry = shape(feature["geometry"])
    assert geometry.is_valid and not geometry.is_empty
    assert geometry.geom_type in ("Polygon", "MultiPolygon")
    assert props["objectid"] not in village_ids, "Duplicate source village"
    village_ids.add(props["objectid"])
    groups[code].append(geometry)
    source_names.setdefault(code, props["wadmkc"])
    assert source_names[code] == props["wadmkc"]

features = []
geometries = []
for code, name in NAMES.items():
    assert groups[code], f"Missing district: {name}"
    geometry = unary_union(groups[code])
    assert geometry.is_valid and geometry.geom_type == "Polygon", f"Review topology of {name}"
    assert not geometry.interiors, f"Unexpected administrative hole in {name}"
    # Preserve every source coordinate. Only remove internal kelurahan boundaries.
    geometry = orient(geometry, sign=1.0)
    geometries.append(geometry)
    label_point = geometry.representative_point()
    features.append({
        "type": "Feature",
        "id": int(code.rsplit(".", 1)[1]),
        "properties": {
            "name": name,
            "code": code,
            "sourceName": source_names[code],
            "sourceVillageCount": len(groups[code]),
            "source": SOURCE,
            "labelPoint": [label_point.x, label_point.y],
        },
        "geometry": mapping(geometry),
    })

city = orient(unary_union(geometries), sign=1.0)
assert city.is_valid and city.geom_type == "Polygon" and not city.interiors
assert abs(sum(g.area for g in geometries) - city.area) < 1e-12, "Districts overlap"
assert city.equals(unary_union([shape(f["geometry"]) for f in source["features"]]))
assert all(106.8 < x < 107.1 for x in [city.bounds[0], city.bounds[2]])
assert all(-6.5 < y < -6.1 for y in [city.bounds[1], city.bounds[3]])
metadata = {
    "source": SOURCE,
    "sourceEdition": "Semester 1 2025",
    "sourceSnapshotDate": "2026-10-01",
    "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
    "attribution": "Batas: BIG (2025), Geoportal Kementan",
    "processing": "Union of 56 source kelurahan by official kdcpum; no simplification or synthetic geometry",
    "license": "Source metadata has no explicit license; see docs/boundaries.md",
}
outputs = {
    "bekasi-kecamatan.geojson": {
        "type": "FeatureCollection", "bbox": list(city.bounds), "metadata": metadata, "features": features,
    },
    "bekasi-boundary.geojson": {
        "type": "FeatureCollection", "bbox": list(city.bounds), "metadata": metadata,
        "features": [{
            "type": "Feature", "id": 3275,
            "properties": {"name": "Kota Bekasi", "code": "32.75", "source": SOURCE},
            "geometry": mapping(city),
        }],
    },
}
for filename, collection in outputs.items():
    path = ROOT / "public/data" / filename
    serialized = json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.check:
        existing = json.loads(path.read_text(encoding="utf-8"))
        assert existing == json.loads(serialized), f"Output differs from retained source: {filename}"
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(serialized, encoding="utf-8")
print(json.dumps({
    "sourceVillageCount": len(village_ids), "districtCount": len(features),
    "valid": True, "outerBoundary": city.geom_type, "holes": len(city.interiors),
    "bbox": list(city.bounds), "sourceSha256": metadata["sourceSha256"],
    "mode": "check" if args.check else "build",
}, indent=2))
