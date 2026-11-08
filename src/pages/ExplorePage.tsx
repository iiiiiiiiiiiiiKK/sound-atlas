/**
 * Explore —the core screen.
 *
 * Layout: map (or list) plus a filter rail and a result list. Search resolves a place
 * name to a viewport through Photon, then asks every provider for the sounds inside that
 * viewport. Every state is explicit: loading, empty, partial (one provider down), error.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Crosshair,
  List as ListIcon,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { usePlayer } from '@/stores/playerStore';
import { useT, useUi } from '@/stores/uiStore';
import { searchSounds } from '@/services/soundService';
import { searchPlaces, type PlaceResult } from '@/services/places';
import { FILTER_CATEGORIES } from '@/services/collections';
import { SoundMap } from '@/components/SoundMap';
import { SoundCard } from '@/components/SoundCard';
import { SoundDetail } from '@/components/SoundDetail';
import { useCategoryLabel } from '@/components/atoms';
import { CATEGORY_COLOR, type Sound, type SoundCategory } from '@/types';

/** A viewport is only detailed enough to query once it is reasonably small. */
const MIN_SEARCH_ZOOM = 4;

interface Filters {
  categories: SoundCategory[];
  sources: ('commons' | 'inaturalist')[];
  minDuration: number;
  onlyPrecise: boolean;
}

const DEFAULT_FILTERS: Filters = { categories: [], sources: ['commons', 'inaturalist'], minDuration: 0, onlyPrecise: false };

export function ExplorePage() {
  const t = useT();
  const categoryLabel = useCategoryLabel();
  const [params, setParams] = useSearchParams();
  const notify = useUi((state) => state.notify);
  const theme = useUi((state) => state.theme);

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [partial, setPartial] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewport, setViewport] = useState<{ center: [number, number]; zoom: number }>({
    center: [20, 10],
    zoom: 2,
  });
  const [selected, setSelected] = useState<Sound | null>(null);
  const [mode, setMode] = useState<'map' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 'list' : 'map'));

  const pendingBBox = useRef<[number, number, number, number] | null>(null);
  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);

  const requestSeq = useRef(0);

  /**
   * Run a search for a bounding box (or the whole world when omitted).
   *
   * Each call takes a sequence number: a slow response that arrives after a newer request
   * has started is discarded instead of overwriting fresher results. Previous results stay
   * on screen while a new search runs, so the page never blanks out between filters.
   */
  const runSearch = useCallback(
    async (bbox?: [number, number, number, number], placeName?: string) => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      setSearching(true);
      setErrors([]);
      try {
        const result = await searchSounds({
          bbox,
          placeName,
          categories: filters.categories.length ? filters.categories : undefined,
          sources: filters.sources.length ? filters.sources : undefined,
          minDuration: filters.minDuration || undefined,
          onlyPrecise: filters.onlyPrecise || undefined,
          limit: 150,
          // The bundled catalogue answers instantly; show it before the live provider does.
          onPartial: (partial) => {
            if (seq !== requestSeq.current) return;
            setSounds(partial.items);
            setTotal(partial.total);
          },
        });
        if (seq !== requestSeq.current) return;
        setSounds(result.items);
        setTotal(result.total);
        setPartial(result.partial);
        setErrors(result.errors);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        setSounds([]);
        setTotal(null);
        setPartial(false);
        setErrors([error instanceof Error ? error.message : 'search failed']);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    },
    [filters],
  );

  // Initial load: whole world, unless the URL asked for a place.
  useEffect(() => {
    void runSearch(undefined, params.get('q') ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run whenever filters change so the map and list always agree.
  useEffect(() => {
    void runSearch(pendingBBox.current ?? undefined, params.get('q') ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Debounced place suggestions.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSuggesting(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(trimmed, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setSuggesting(false);
      }
    }, 320);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choosePlace = (place: PlaceResult) => {
    setSuggestions([]);
    setQuery(place.name);
    setViewport({ center: [place.lat, place.lon], zoom: place.zoom });
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('q', place.name);
      return next;
    });
    const span = place.bbox ? bboxFrom(place.bbox) : bboxAround(place.lat, place.lon, place.zoom);
    pendingBBox.current = span;
    void runSearch(span, place.name);
  };

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      pendingBBox.current = null;
      setParams(new URLSearchParams());
      void runSearch();
      return;
    }
    if (suggestions.length) {
      choosePlace(suggestions[0]!);
      return;
    }
    setSuggesting(true);
    const results = await searchPlaces(trimmed);
    setSuggesting(false);
    if (results.length) choosePlace(results[0]!);
    else notify(t('explore.empty'), 'error');
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      notify(t('explore.locateUnsupported'), 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setViewport({ center: [latitude, longitude], zoom: 11 });
        const span = bboxAround(latitude, longitude, 11);
        pendingBBox.current = span;
        void runSearch(span);
      },
      () => notify(t('explore.locateDenied'), 'error'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const searchThisArea = (bbox: [number, number, number, number], zoom: number) => {
    pendingBBox.current = bbox;
    if (zoom < MIN_SEARCH_ZOOM) return;
    void runSearch(bbox);
  };

  /**
   * Track where the user actually dragged the map, so "search this area" reflects the
   * live viewport instead of the last programmatic jump.
   */
  const onBoundsChange = useCallback((bbox: [number, number, number, number], zoom: number) => {
    pendingBBox.current = bbox;
    setViewport((current) =>
      current.zoom === zoom ? current : { ...current, zoom },
    );
  }, []);

  const activeFilterCount =
    filters.categories.length + (filters.sources.length === 2 ? 0 : 1) + (filters.minDuration ? 1 : 0) + (filters.onlyPrecise ? 1 : 0);

  const sortedForList = useMemo(() => sounds.slice(0, 150), [sounds]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">{t('explore.title')}</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('explore.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full border p-0.5" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setMode('map')}
              className="focus-ring inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px]"
              style={{ background: mode === 'map' ? 'var(--bg-panel)' : 'transparent', color: mode === 'map' ? 'var(--text)' : 'var(--text-mute)' }}
              aria-pressed={mode === 'map'}
            >
              <MapIcon size={12} />
              {t('explore.map')}
            </button>
            <button
              type="button"
              onClick={() => setMode('list')}
              className="focus-ring inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px]"
              style={{ background: mode === 'list' ? 'var(--bg-panel)' : 'transparent', color: mode === 'list' ? 'var(--text)' : 'var(--text-mute)' }}
              aria-pressed={mode === 'list'}
            >
              <ListIcon size={12} />
              {t('explore.list')}
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- search bar */}
      <form onSubmit={submitSearch} className="relative flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-mute)' }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('explore.searchPlaceholder')}
            aria-label={t('explore.searchPlaceholder')}
            className="focus-ring w-full rounded-full border py-2.5 pl-9 pr-9 text-[13px] outline-none placeholder:text-[var(--text-mute)]"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1"
              aria-label={t('common.close')}
              style={{ color: 'var(--text-mute)' }}
            >
              <X size={13} />
            </button>
          ) : null}

          {suggestions.length ? (
            <ul
              className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border shadow-xl"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)' }}
            >
              {suggestions.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => choosePlace(place)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-[var(--bg-panel)]"
                  >
                    <span className="truncate">{place.name}</span>
                    <span className="flex-none truncate text-[11px]" style={{ color: 'var(--text-mute)' }}>
                      {place.detail}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="submit"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {suggesting || searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {t('explore.search')}
        </button>

        <button
          type="button"
          onClick={locate}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-[12.5px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          <Crosshair size={13} />
          <span className="hidden sm:inline">{t('explore.locate')}</span>
        </button>

        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-[12.5px]"
          style={{ borderColor: activeFilterCount ? 'var(--accent)' : 'var(--border)', color: activeFilterCount ? 'var(--accent)' : 'var(--text-dim)' }}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={13} />
          {t('explore.filters')}
          {activeFilterCount ? <span className="font-mono text-[10px]">({activeFilterCount})</span> : null}
        </button>
      </form>

      {/* ------------------------------------------------------------ filters */}
      {filtersOpen ? (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
                {t('sound.category')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_CATEGORIES.map((category) => {
                  const active = filters.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          categories: active ? current.categories.filter((entry) => entry !== category) : [...current.categories, category],
                        }))
                      }
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: active ? CATEGORY_COLOR[category] : 'var(--border)',
                        color: active ? 'var(--text)' : 'var(--text-mute)',
                        background: active ? `color-mix(in srgb, ${CATEGORY_COLOR[category]} 18%, transparent)` : 'transparent',
                      }}
                      aria-pressed={active}
                    >
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: CATEGORY_COLOR[category] }} />
                      {categoryLabel(category)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
                {t('explore.source')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['commons', 'inaturalist'] as const).map((source) => {
                  const active = filters.sources.includes(source);
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          sources: active
                            ? current.sources.filter((entry) => entry !== source)
                            : [...current.sources, source],
                        }))
                      }
                      className="focus-ring rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        color: active ? 'var(--text)' : 'var(--text-mute)',
                      }}
                      aria-pressed={active}
                    >
                      {source === 'commons' ? 'Wikimedia Commons' : 'iNaturalist'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
                {t('explore.minDuration')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[0, 10, 30, 60].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, minDuration: seconds }))}
                    className="focus-ring rounded-full border px-2 py-0.5 text-[11px]"
                    style={{
                      borderColor: filters.minDuration === seconds ? 'var(--accent)' : 'var(--border)',
                      color: filters.minDuration === seconds ? 'var(--text)' : 'var(--text-mute)',
                    }}
                    aria-pressed={filters.minDuration === seconds}
                  >
                    {seconds === 0 ? t('explore.durationAny') : `≥${seconds}s`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
                {t('sound.place')}
              </div>
              <label className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                <input
                  type="checkbox"
                  checked={filters.onlyPrecise}
                  onChange={(event) => setFilters((current) => ({ ...current, onlyPrecise: event.target.checked }))}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                {t('explore.onlyPrecise')}
              </label>
            </div>

            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="focus-ring ml-auto self-end rounded-full border px-2.5 py-1 text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
            >
              {t('explore.clearFilters')}
            </button>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- result meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: 'var(--text-mute)' }}>
        {/* The count stays visible while a new search runs, so the page never looks empty. */}
        {sounds.length > 0 ? (
          <span>
            {total != null ? t('explore.showing', { shown: sounds.length, total }) : t('explore.showingApprox', { shown: sounds.length })}
          </span>
        ) : null}
        {searching ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            {t('explore.loading')}
          </span>
        ) : null}
        {partial ? <span style={{ color: 'var(--warm)' }}>· {t('explore.partial')}</span> : null}
        {errors.length ? (
          <button
            type="button"
            onClick={() => void runSearch(pendingBBox.current ?? undefined, params.get('q') ?? undefined)}
            className="inline-flex items-center gap-1 underline"
          >
            <RefreshCw size={11} />
            {t('explore.retry')}
          </button>
        ) : null}
        {viewport.zoom < MIN_SEARCH_ZOOM ? <span>· {t('explore.zoomHint')}</span> : null}
      </div>

      {/* -------------------------------------------------------------- body */}
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', minHeight: mode === 'map' ? 460 : undefined }}>
          {mode === 'map' ? (
            <>
              <div className="h-[52vh] min-h-[380px] lg:h-[calc(100vh-330px)]">
                <SoundMap
                  sounds={sounds}
                  activeId={currentId}
                  center={viewport.center}
                  zoom={viewport.zoom}
                  onSelect={(sound) => setSelected(sound)}
                  onBoundsChange={onBoundsChange}
                  theme={theme}
                />
              </div>
              <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2">
                <button
                  type="button"
                  onClick={() => {
                    if (pendingBBox.current) searchThisArea(pendingBBox.current, viewport.zoom);
                  }}
                  disabled={viewport.zoom < MIN_SEARCH_ZOOM}
                  className="pointer-events-auto rounded-full border px-3 py-1.5 text-[11.5px] shadow-lg disabled:opacity-50"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
                >
                  {t('explore.bboxSearch')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto p-2 scroll-thin">
              {searching && !sounds.length ? (
                <div className="flex items-center gap-2 p-4 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  {t('explore.loading')}
                </div>
              ) : sortedForList.length ? (
                sortedForList.map((sound) => <SoundCard key={sound.id} sound={sound} queue={sounds} />)
              ) : (
                <EmptyState />
              )}
            </div>
          )}
        </div>

        <aside className="hidden flex-col gap-2 lg:flex">
          {selected ? (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)', maxHeight: 'calc(100vh - 300px)' }}>
              <SoundDetail sound={selected} queue={sounds} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto rounded-xl border p-2 scroll-thin" style={{ borderColor: 'var(--border)' }}>
              {sortedForList.length ? (
                sortedForList.map((sound) => <SoundCard key={sound.id} sound={sound} queue={sounds} />)
              ) : (
                <EmptyState />
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile detail sheet */}
      {selected && mode !== 'list' ? (
        <div className="fixed inset-0 z-[950] flex items-end lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative max-h-[82vh] w-full overflow-y-auto rounded-t-2xl border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
            <SoundDetail sound={selected} queue={sounds} onClose={() => setSelected(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      <p className="text-[13px]">{t('explore.empty')}</p>
      <p className="text-[11.5px]" style={{ color: 'var(--text-mute)' }}>
        {t('explore.emptyHint')}
      </p>
    </div>
  );
}

/** Convert a Photon extent [west, north, east, south] into [w,s,e,n]. */
function bboxFrom(extent: [number, number, number, number]): [number, number, number, number] {
  const [west, north, east, south] = extent;
  return [Math.min(west, east), Math.min(south, north), Math.max(west, east), Math.max(south, north)];
}

/** Approximate a viewport box for a centre and zoom level. */
function bboxAround(lat: number, lon: number, zoom: number): [number, number, number, number] {
  const span = Math.max(0.6, 360 / 2 ** Math.max(1, zoom - 2));
  const latSpan = span * 0.75;
  return [
    Math.max(-180, lon - span),
    Math.max(-85, lat - latSpan),
    Math.min(180, lon + span),
    Math.min(85, lat + latSpan),
  ];
}


