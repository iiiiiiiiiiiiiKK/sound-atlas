/**
 * Leaflet map with one marker per located sound.
 *
 * Markers are divIcons coloured by sound category; the currently playing sound gets an
 * `is-active` class so it pulses. The map owns no data: it renders whatever sounds it
 * is given and reports the viewport back through `onBoundsChange`.
 *
 * Basemap: a dark/light CARTO raster set that matches the app's theme, with the public
 * OSM tile service as a documented fallback. If the active provider keeps failing (some
 * networks block it), the layer swaps to the next entry in `TILE_PROVIDERS` so the map
 * never renders as an empty grid without explanation.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORY_COLOR, type Sound } from '@/types';

export interface TileProvider {
  name: string;
  url: string;
  attribution: string;
  /** Optional dark/light variant of the same provider. */
  darkUrl?: string;
  lightUrl?: string;
}

export const TILE_PROVIDERS: TileProvider[] = [
  {
    name: 'CARTO',
    url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    darkUrl: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    lightUrl: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

export interface SoundMapProps {
  sounds: Sound[];
  activeId: string | null;
  center: [number, number];
  zoom: number;
  onSelect: (sound: Sound) => void;
  onBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  /** `dark` / `light` selects the provider's matching style when it has one. */
  theme?: 'dark' | 'light';
  className?: string;
}

interface MarkerRecord {
  marker: L.Marker;
  element: HTMLElement;
}

/** Resolve the URL for a provider given the active theme. */
export function tileUrlFor(provider: TileProvider, theme: 'dark' | 'light'): string {
  if (theme === 'dark' && provider.darkUrl) return provider.darkUrl;
  if (theme === 'light' && provider.lightUrl) return provider.lightUrl;
  return provider.url;
}

export function SoundMap({
  sounds,
  activeId,
  center,
  zoom,
  onSelect,
  onBoundsChange,
  theme = 'dark',
  className,
}: SoundMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const selectRef = useRef(onSelect);
  const boundsRef = useRef(onBoundsChange);
  const themeRef = useRef<'dark' | 'light'>(theme);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  selectRef.current = onSelect;
  boundsRef.current = onBoundsChange;

  // ---- create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 13,
      preferCanvas: false,
    });

    // Add the first provider, then fall back if its tiles keep failing to load.
    let providerIndex = 0;
    let tileLayer: L.TileLayer | null = null;
    let errorCount = 0;

    const attachTiles = () => {
      const provider = TILE_PROVIDERS[providerIndex];
      if (!provider) return;
      if (tileLayer) map.removeLayer(tileLayer);
      // Record which provider is live so the stylesheet knows whether to invert.
      if (containerRef.current) containerRef.current.dataset.tiles = provider.name;
      tileLayer = L.tileLayer(tileUrlFor(provider, themeRef.current), {
        maxZoom: 19,
        attribution: provider.attribution,
        crossOrigin: true,
        detectRetina: false,
      });
      errorCount = 0;
      tileLayer.on('tileerror', () => {
        errorCount += 1;
        // A handful of misses is normal at the edges of a world view; a run of them is not.
        if (errorCount >= 6 && providerIndex < TILE_PROVIDERS.length - 1) {
          providerIndex += 1;
          attachTiles();
        }
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;
    };
    attachTiles();

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const emit = () => {
      const bounds = map.getBounds();
      boundsRef.current?.(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        map.getZoom(),
      );
    };
    map.on('moveend', emit);
    // Report the initial viewport so the first search can use it.
    setTimeout(emit, 0);

    return () => {
      map.off('moveend', emit);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- swap the basemap style when the app theme changes
  useEffect(() => {
    themeRef.current = theme;
    const map = mapRef.current;
    const tile = tileLayerRef.current;
    if (!map || !tile) return;
    const currentAttribution = tile.options.attribution;
    const provider = TILE_PROVIDERS.find((entry) => entry.attribution === currentAttribution) ?? TILE_PROVIDERS[0];
    if (provider) tile.setUrl(tileUrlFor(provider, theme));
  }, [theme]);

  // ---- respond to an external centre/zoom change (search results, locate, random)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const moved = Math.abs(current.lat - center[0]) > 0.0005 || Math.abs(current.lng - center[1]) > 0.0005;
    if (moved || map.getZoom() !== zoom) map.setView(center, zoom, { animate: true });
  }, [center, zoom]);

  // ---- (re)build markers
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    // Group co-located sounds so a city with 20 recordings draws one larger marker.
    const groups = new Map<string, Sound[]>();
    for (const sound of sounds) {
      if (!sound.place) continue;
      // Round to ~1km so near-identical city placements stack instead of overlapping.
      const key = `${sound.place.lat.toFixed(2)}:${sound.place.lon.toFixed(2)}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(sound);
      else groups.set(key, [sound]);
    }

    for (const [, bucket] of groups) {
      const first = bucket[0];
      if (!first?.place) continue;
      const size = Math.min(30, 11 + Math.log2(bucket.length + 1) * 5);
      const color = CATEGORY_COLOR[first.soundCategory] ?? '#4fd1b5';
      const icon = L.divIcon({
        className: 'sound-marker',
        html: `<span class="dot" style="background:${color};width:${size}px;height:${size}px;opacity:${
          bucket.length > 1 ? 0.95 : 0.85
        }"></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([first.place.lat, first.place.lon], {
        icon,
        title: bucket.length > 1 ? `${bucket.length} sounds` : first.title,
        riseOnHover: true,
        keyboard: true,
      });
      marker.on('click', () => selectRef.current(bucket.length > 1 ? bucket[0] : first));
      marker.addTo(layer);
      const element = marker.getElement();
      if (element) markersRef.current.set(first.id, { marker, element });
      for (const extra of bucket.slice(1)) {
        markersRef.current.set(extra.id, { marker, element: element ?? document.createElement('span') });
      }
    }
  }, [sounds]);

  // ---- highlight the playing sound
  useEffect(() => {
    for (const [id, record] of markersRef.current) {
      const active = id === activeId;
      record.element?.classList.toggle('is-active', active);
      if (active && record.marker && mapRef.current) {
        const position = record.marker.getLatLng();
        if (!mapRef.current.getBounds().pad(-0.15).contains(position)) {
          mapRef.current.panTo(position, { animate: true });
        }
      }
    }
  }, [activeId]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
