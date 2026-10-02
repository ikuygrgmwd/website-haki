import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon, Position } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'
import { countColor } from './map-scale'

// v6's worker must pass through Vite so its shared imports are bundled as well.
maplibregl.setWorkerUrl(workerUrl)

export interface DistrictCount { name: string; count: number }
export interface LegendRange { min: number; max: number; color: string; label: string }
export interface BekasiMap {
  update: (counts: DistrictCount[], selectedDistrict: string | null) => void
  reset: () => void
  destroy: () => void
}

const SOURCE_ATTRIBUTION = 'Batas: <a href="https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0" target="_blank" rel="noopener noreferrer">BIG (2025), Geoportal Kementan</a>'

function coordinates(geometry: Geometry): Position[] {
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(coordinates)
  const positions: Position[] = []
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') positions.push(value as Position)
    else value.forEach(visit)
  }
  visit(geometry.coordinates)
  return positions
}

function districtBounds(data: FeatureCollection): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds()
  for (const feature of data.features) for (const point of coordinates(feature.geometry)) bounds.extend([point[0], point[1]])
  return bounds
}

function outsideMask(city: FeatureCollection<Polygon | MultiPolygon>): FeatureCollection<Polygon> {
  const rings: Position[][] = []
  const islands: Feature<Polygon>[] = []
  const area = (ring: Position[]) => ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)
  for (const feature of city.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) {
      rings.push(area(polygon[0]) > 0 ? [...polygon[0]].reverse() : polygon[0])
      for (const hole of polygon.slice(1)) islands.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [hole] } })
    }
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...rings] } }, ...islands] }
}

async function fetchBoundaries(path: string): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('Batas wilayah tidak dapat dimuat. Periksa koneksi lalu coba lagi.')
  const data = await response.json()
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.some((feature: Feature) => !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))) {
    throw new Error('Data batas wilayah tidak valid.')
  }
  return data
}

/** The caller handles rejection and supplies a retry action. Basemap failure is nonfatal. */
export async function createBekasiMap(
  container: HTMLElement,
  counts: DistrictCount[],
  selectedDistrict: string | null,
  onSelect: (name: string) => void,
  scaleCounts: DistrictCount[] = counts,
): Promise<BekasiMap> {
  container.classList.add('bekasi-map')
  container.replaceChildren()
  container.setAttribute('aria-label', 'Peta sebaran inovasi di 12 kecamatan Kota Bekasi')

  const canvasHost = document.createElement('div')
  canvasHost.className = 'bekasi-map-canvas'
  const loading = document.createElement('div')
  loading.className = 'bekasi-map-loading'
  loading.setAttribute('role', 'status')
  loading.textContent = 'Memuat batas 12 kecamatan…'
  container.append(canvasHost, loading)

  let map: LibreMap | undefined
  try {
    const [districts, city] = await Promise.all([fetchBoundaries('bekasi-kecamatan.geojson'), fetchBoundaries('bekasi-boundary.geojson')])
    if (districts.features.length !== 12 || new Set(districts.features.map(feature => feature.properties?.name)).size !== 12) {
      throw new Error('Batas wilayah harus mencakup 12 kecamatan Kota Bekasi.')
    }
    const bounds = districtBounds(districts)
    const width = bounds.getEast() - bounds.getWest()
    const height = bounds.getNorth() - bounds.getSouth()
    // Allow the horizontal room needed by a wide viewport while fitting this tall city.
    const maxBounds = new maplibregl.LngLatBounds([bounds.getWest() - width * 1.5, bounds.getSouth() - height * .75], [bounds.getEast() + width * 1.5, bounds.getNorth() + height * .75])
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map = new maplibregl.Map({
      container: canvasHost,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f1f5f9' } }] },
      center: bounds.getCenter(),
      zoom: 11,
      minZoom: 9,
      maxZoom: 16,
      maxBounds,
      attributionControl: false,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      locale: { 'NavigationControl.ZoomIn': 'Perbesar peta', 'NavigationControl.ZoomOut': 'Perkecil peta', 'AttributionControl.ToggleAttribution': 'Tampilkan sumber peta' },
    })
    const activeMap = map
    activeMap.touchZoomRotate.disableRotation()
    activeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    activeMap.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: SOURCE_ATTRIBUTION }), 'bottom-right')
    activeMap.getCanvas().setAttribute('aria-label', 'Peta Kota Bekasi. Gunakan tombol panah untuk menggeser, tambah atau kurang untuk mengubah zoom. Pilih kecamatan melalui menu di atas peta.')
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Peta belum dapat ditampilkan. Muat ulang peta untuk mencoba lagi.')), 15000)
      activeMap.once('load', () => { window.clearTimeout(timer); resolve() })
      activeMap.once('error', event => { window.clearTimeout(timer); reject(event.error) })
    })

    let currentCounts = counts
    let currentSelection = selectedDistrict
    let hovered: string | null = null
    const immutableScale = scaleCounts.map(row => ({ ...row }))
    const countFor = (name: string) => currentCounts.find(row => row.name === name)?.count ?? 0
    const withCounts = (): FeatureCollection => ({
      ...districts,
      features: districts.features.map(feature => ({ ...feature, properties: { ...feature.properties, count: countFor(feature.properties!.name), color: countColor(countFor(feature.properties!.name), immutableScale) } })),
    })
    activeMap.addSource('districts', { type: 'geojson', data: withCounts(), promoteId: 'name' })
    activeMap.addSource('city', { type: 'geojson', data: city })
    activeMap.addSource('outside', { type: 'geojson', data: outsideMask(city) })
    activeMap.addLayer({ id: 'outside-dim', type: 'fill', source: 'outside', paint: { 'fill-color': '#d9dce1', 'fill-opacity': .72 } })
    activeMap.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, .90] } })
    activeMap.addLayer({ id: 'district-lines', type: 'line', source: 'districts', paint: { 'line-color': '#f8fafc', 'line-width': 1.7, 'line-opacity': 1 } })
    activeMap.addLayer({ id: 'city-outline', type: 'line', source: 'city', paint: { 'line-color': '#1e40af', 'line-width': 3, 'line-opacity': .92 } })
    activeMap.addLayer({ id: 'district-selected', type: 'line', source: 'districts', filter: ['==', ['get', 'name'], currentSelection ?? ''], paint: { 'line-color': '#273242', 'line-width': 3.7 } })
    activeMap.addLayer({ id: 'district-hover', type: 'line', source: 'districts', paint: { 'line-color': '#273242', 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] } })

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { window.clearTimeout(timer); activeMap.off('sourcedata', check); activeMap.off('error', fail) }
      const check = () => {
        if (['districts', 'city', 'outside'].every(id => activeMap.isSourceLoaded(id))) { cleanup(); resolve() }
      }
      const fail = (event: maplibregl.ErrorEvent) => { cleanup(); reject(new Error(event.error.message)) }
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('Batas kecamatan belum dapat digambar.')) }, 20000)
      activeMap.on('sourcedata', check)
      activeMap.on('error', fail)
      check()
    })

    const toolbar = document.createElement('div')
    toolbar.className = 'bekasi-map-toolbar'
    const selectLabel = document.createElement('label')
    selectLabel.textContent = 'Kecamatan'
    const select = document.createElement('select')
    select.setAttribute('aria-label', 'Pilih kecamatan pada peta')
    const placeholder = new Option('Semua kecamatan', '')
    select.append(placeholder)
    for (const feature of [...districts.features].sort((a, b) => String(a.properties!.name).localeCompare(String(b.properties!.name)))) {
      select.append(new Option(`${feature.properties!.name} · ${countFor(feature.properties!.name)}`, feature.properties!.name))
    }
    select.value = currentSelection ?? ''
    select.addEventListener('change', () => onSelect(select.value))
    selectLabel.append(select)
    const resetButton = document.createElement('button')
    resetButton.type = 'button'
    resetButton.className = 'bekasi-map-reset'
    resetButton.textContent = '↗ Reset tampilan'
    resetButton.setAttribute('aria-label', 'Kembalikan tampilan ke seluruh Kota Bekasi')
    toolbar.append(selectLabel, resetButton)
    container.append(toolbar)

    const status = document.createElement('div')
    status.className = 'bekasi-map-status'
    status.setAttribute('role', 'status')
    status.hidden = true
    container.append(status)

    const reset = () => {
      activeMap.fitBounds(bounds, { padding: { top: 105, right: 50, bottom: 64, left: 30 }, maxZoom: 12, duration: reduceMotion ? 0 : 450 })
    }
    resetButton.addEventListener('click', reset)
    activeMap.fitBounds(bounds, { padding: { top: 105, right: 50, bottom: 64, left: 30 }, maxZoom: 12, duration: 0 })
    activeMap.setMinZoom(Math.max(9, activeMap.getZoom() - .8))

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: '260px', className: 'bekasi-map-tooltip' })
    let popupName: string | null = null
    const popupContent = (name: string): HTMLElement => {
      const content = document.createElement('div')
      const heading = document.createElement('strong')
      heading.textContent = name
      const count = document.createElement('span')
      count.textContent = `${countFor(name)} inovasi berdasarkan domisili pencipta`
      content.append(heading, count)
      return content
    }
    const clearHover = () => {
      activeMap.getCanvas().style.cursor = ''
      if (hovered) activeMap.setFeatureState({ source: 'districts', id: hovered }, { hover: false })
      hovered = null
      popupName = null
      popup.remove()
    }
    activeMap.on('mousemove', event => {
      const name = activeMap.queryRenderedFeatures(event.point, { layers: ['district-fill'] })[0]?.properties?.name as string | undefined
      if (!name) { clearHover(); return }
      activeMap.getCanvas().style.cursor = 'pointer'
      if (hovered && hovered !== name) activeMap.setFeatureState({ source: 'districts', id: hovered }, { hover: false })
      hovered = name
      activeMap.setFeatureState({ source: 'districts', id: name }, { hover: true })
      popupName = name
      popup.setLngLat(event.lngLat).setDOMContent(popupContent(name)).addTo(activeMap)
    })
    activeMap.getCanvas().addEventListener('mouseleave', clearHover)
    activeMap.on('click', 'district-fill', event => {
      const name = event.features?.[0]?.properties?.name as string | undefined
      if (!name) return
      onSelect(name)
      popupName = name
      popup.setLngLat(event.lngLat).setDOMContent(popupContent(name)).addTo(activeMap)
    })
    activeMap.on('click', event => {
      if (!activeMap.queryRenderedFeatures(event.point, { layers: ['district-fill'] }).length) { popupName = null; popup.remove() }
    })

    // DOM markers keep labels local: no font server or remote glyphs are needed.
    const labels: Array<{ name: string; element: HTMLElement; count: HTMLElement; marker: maplibregl.Marker }> = []
    for (const feature of districts.features) {
      const name = String(feature.properties!.name)
      const fallback = districtBounds({ type: 'FeatureCollection', features: [feature] }).getCenter()
      const point = feature.properties!.labelPoint as number[] | undefined
      const element = document.createElement('div')
      element.className = 'bekasi-map-label'
      element.dataset.districtName = name
      element.setAttribute('aria-hidden', 'true')
      const title = document.createElement('span')
      title.textContent = name
      const value = document.createElement('b')
      value.textContent = String(countFor(name))
      element.append(title, value)
      const marker = new maplibregl.Marker({ element }).setLngLat(point ? [point[0], point[1]] : fallback).addTo(activeMap)
      labels.push({ name, element, count: value, marker })
    }
    const updateLabels = () => labels.forEach(label => label.element.classList.toggle('compact-label', activeMap.getZoom() < 12))
    activeMap.on('zoom', updateLabels)
    updateLabels()

    // Tiles add geographical context; all analytical layers work if tiles are unavailable.
    let basemapFailed = false
    activeMap.on('error', event => {
      if ((event as { sourceId?: string }).sourceId === 'osm' && !basemapFailed) {
        basemapFailed = true
        status.hidden = false
        status.textContent = 'Peta dasar tidak tersedia. Batas dan data kecamatan tetap ditampilkan.'
      }
    })
    activeMap.addSource('osm', { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' })
    activeMap.addLayer({ id: 'osm-base', source: 'osm', type: 'raster', paint: { 'raster-opacity': .38, 'raster-saturation': -.8 } }, 'outside-dim')
    loading.remove()

    let destroyed = false
    let previousWidth = container.clientWidth
    let previousHeight = container.clientHeight
    const observer = new ResizeObserver(() => {
      if (!destroyed) {
        activeMap.resize()
        if (previousWidth !== container.clientWidth || previousHeight !== container.clientHeight) reset()
        previousWidth = container.clientWidth
        previousHeight = container.clientHeight
      }
    })
    observer.observe(container)
    return {
      update(nextCounts, nextSelected) {
        if (destroyed) return
        currentCounts = nextCounts
        currentSelection = nextSelected
        ;(activeMap.getSource('districts') as GeoJSONSource).setData(withCounts())
        activeMap.setFilter('district-selected', ['==', ['get', 'name'], currentSelection ?? ''])
        select.value = currentSelection ?? ''
        for (const option of Array.from(select.options)) if (option.value) option.textContent = `${option.value} · ${countFor(option.value)}`
        for (const label of labels) {
          label.count.textContent = String(countFor(label.name))
          label.element.classList.toggle('is-selected', label.name === currentSelection)
        }
        if (popupName && popup.isOpen()) popup.setDOMContent(popupContent(popupName))
      },
      reset,
      destroy() {
        if (destroyed) return
        destroyed = true
        observer.disconnect()
        popup.remove()
        for (const label of labels) label.marker.remove()
        activeMap.remove()
        container.replaceChildren()
      },
    }
  } catch (error) {
    map?.remove()
    container.replaceChildren()
    throw error instanceof Error ? error : new Error('Peta belum dapat dimuat.')
  }
}
