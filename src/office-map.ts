import { Map, Marker, NavigationControl, Popup, ScaleControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { office } from "./data";

// Bundle the v6 module worker and its shared imports through Vite's worker pipeline.
setWorkerUrl(workerUrl);

export function createOfficeMap(container: HTMLElement) {
  const status = document.querySelector<HTMLElement>("#map-status");
  const map = new Map({
    container,
    center: office.coordinates,
    zoom: 14,
    maxZoom: 19,
    attributionControl: { compact: true },
    locale: {
      "NavigationControl.ZoomIn": "Perbesar peta",
      "NavigationControl.ZoomOut": "Perkecil peta",
      "NavigationControl.ResetBearing": "Arahkan ke utara",
      "AttributionControl.ToggleAttribution": "Tampilkan atribusi peta",
      "AttributionControl.MapFeedback": "Masukan peta",
    },
    style: {
      version: 8,
      sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' } },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
  });
  const popup = new Popup({ offset: 30, closeButton: false }).setHTML(`<strong>${office.name}</strong><p>${office.address}</p>`);
  const marker = new Marker({ color: "#245bd8" }).setLngLat(office.coordinates).setPopup(popup).addTo(map);
  marker.getElement().setAttribute("aria-label", office.name);
  marker.getElement().setAttribute("role", "button");
  marker.getElement().tabIndex = 0;
  marker.getElement().addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); marker.togglePopup(); }
  });
  marker.togglePopup();
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new ScaleControl({ unit: "metric" }));
  map.on("load", () => { container.dataset.loaded = "true"; if (status) status.hidden = true; });
  map.on("idle", () => { if (map.isSourceLoaded("osm") && status) status.hidden = true; });
  map.on("error", () => { if (status) { status.hidden = false; status.textContent = "Peta belum dapat dimuat. Periksa koneksi internet Anda."; } });
  const canvas = map.getCanvas();
  canvas.setAttribute("aria-label", "Peta lokasi Kantor Bappelitbangda Kota Bekasi");
  const resize = new ResizeObserver(() => map.resize());
  resize.observe(container);
  return () => { resize.disconnect(); map.remove(); };
}
