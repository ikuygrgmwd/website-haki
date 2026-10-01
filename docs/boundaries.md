# Kota Bekasi administrative boundaries

The dashboard uses real administrative polygons, separately obtained from the copyright feeder. No coordinates were drawn or estimated from creator addresses.

## Source and provenance

- Publisher/host: **Geoportal Kementerian Pertanian Republik Indonesia**.
- Dataset: **Batas Administrasi Desa/Kelurahan**, edition **Semester 1 2025**. The layer describes the BIG boundary compilation and its updates against Kemendagri administrative codes.
- [Official layer and detailed source description](https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0).
- [Official public item metadata](https://geoportal.pertanian.go.id/portal/sharing/rest/content/items/c4c0adda710c4193a9940440a517f57d?f=pjson), item `c4c0adda710c4193a9940440a517f57d`.
- Retrieved: **1 October 2026**.
- Selection: `kdpkab='32.75'`, the official code for **Kota Bekasi**, not Kabupaten Bekasi. All 56 returned kelurahan have `wadmkk='Kota Bekasi'`.
- Geometry: GeoJSON, EPSG:4326 (longitude, latitude), `returnZ=false`.
- Retained source snapshot: `scripts/boundaries-source.geojson`.
- SHA-256: `dd07dca8be084c3d72f9b96c6cc7ee4cdcd19878548882a185fa3187875304cb`.

The public service's layer copyright field, item `accessInformation`, and item `licenseInfo` are empty. Its access is `public`; it does **not** state an explicit open-data license. This project records that accurately and retains source attribution; it does not claim CC-BY, public-domain, or an invented license. A license/redistribution determination remains an administrative review item for publication beyond the application.

Display attribution: **Batas: BIG (2025), Geoportal Kementan**, linked to the official layer above. Basemap attribution is separate and must also stay visible.

## Processing and data contract

`scripts/boundaries-build.py` dissolves the 56 kelurahan geometries by their official `kdcpum` kecamatan code. It then dissolves the 12 kecamatan into the city outline. It preserves every source coordinate and performs no simplification, snapping, buffering, gap filling, manual editing, or synthetic geometry generation. Polygon winding is normalized to the GeoJSON right-hand rule.

- `public/data/bekasi-kecamatan.geojson`: FeatureCollection of **12 Polygon features**. `properties.name` matches the dashboard's canonical name, `properties.code` contains the official code, `properties.sourceName` preserves the source spelling, and `properties.labelPoint` is a point guaranteed to lie inside its polygon. Numeric feature IDs are the final two digits of the official code; `name` can also be used with MapLibre `promoteId`.
- `public/data/bekasi-boundary.geojson`: FeatureCollection containing one city Polygon, with no holes. Use it for the stronger outer outline and the hole in the outside-city dimming mask.
- Both collections carry `bbox` and source metadata. Bounding box: `[106.89772400000004, -6.398524403999943, 107.04238958900000004, -6.1721883309999725]`.
- These files contain administrative geometry and labels only. No feeder or personal data is included.

| Official code | Dashboard name | Source name | Kelurahan |
| --- | --- | --- | ---: |
| 32.75.01 | Bekasi Timur | Bekasi Timur | 4 |
| 32.75.02 | Bekasi Barat | Bekasi Barat | 5 |
| 32.75.03 | Bekasi Utara | Bekasi Utara | 6 |
| 32.75.04 | Bekasi Selatan | Bekasi Selatan | 5 |
| 32.75.05 | Rawalumbu | Rawalumbu | 4 |
| 32.75.06 | Medan Satria | Medansatria | 4 |
| 32.75.07 | Bantargebang | Bantargebang | 4 |
| 32.75.08 | Pondok Gede | Pondokgede | 5 |
| 32.75.09 | Jatiasih | Jatiasih | 6 |
| 32.75.10 | Jatisampurna | Jatisampurna | 5 |
| 32.75.11 | Mustikajaya | Mustikajaya | 4 |
| 32.75.12 | Pondok Melati | Pondokmelati | 4 |

## Spelling reference for the feeder

The official kecamatan website identifies **Pondokgede** as a kecamatan in **Kota Bekasi**, and also uses **Pondok Gede** in its history. This verifies that the feeder's candidate typo **Pondogede** can be normalized to the requested display name **Pondok Gede**, while retaining its original text and a correction note. Reference: [Kecamatan Pondokgede — Sejarah](https://kec-pondokgede.bekasikota.go.id/User/sejarah).

The government geometry confirms **Rawalumbu** (`32.75.05`), so **Rawalumnu** can likewise be normalized with the original preserved. These are explicit aliases; do not fuzzy-match arbitrary other places into Kota Bekasi. District membership requires a match against the 12-code master list. `Bekasi` in a city/county column alone is insufficient.

## Rebuild and verification

Install Shapely 2.x in a Python environment, then run from the project root:

```sh
python scripts/boundaries-build.py
python scripts/boundaries-build.py --check
```

The recorded build used Python 3.12, Shapely 2.1.2. `--dependency-path PATH` supports a temporary dependency installation. The default build is offline and uses the retained source. An intentional upstream refresh can use `--download`; review changes and update the recorded snapshot date/hash before distributing the new files.

The checks passed for the delivered snapshot:

- 56 unique source features, all in Kota Bekasi and all topologically valid.
- Exactly the 12 expected official kecamatan codes and display names.
- All 12 dissolved district polygons valid and free of holes.
- District areas have no positive-area overlaps (tolerance `1e-12` square degrees).
- The city union equals the union of all 56 original kelurahan exactly.
- City polygon valid, connected, and free of holes; coordinates fall within the expected Bekasi extent.
- Each label point is an interior representative point.
- The `--check` command regenerates in memory and compares both delivered GeoJSON files with the retained source.

The upstream layer notes that some Indonesian administrative boundaries remain indicative and may be updated or subject to claims. The application is an innovation dashboard; this geometry should not be treated as a legal survey of property or disputed boundaries.
