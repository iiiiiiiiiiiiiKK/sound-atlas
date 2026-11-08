/**
 * Home — the product's front door.
 *
 * The hero is a live globe outline with real sound points plotted on it, so the first
 * screen is the product itself rather than a decorative illustration. Below it the page
 * explains what it is, shows real recordings, and lets the visitor start anywhere.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Globe2, Loader2, Pause, Play, Shuffle, Volume2 } from 'lucide-react';
import { useLang, useT } from '@/stores/uiStore';
import { usePlayer } from '@/stores/playerStore';
import { loadCatalog } from '@/services/sources/commons';
import { searchSounds } from '@/services/soundService';
import { CATEGORY_COLOR, type Sound } from '@/types';
import { SoundCard } from '@/components/SoundCard';
import { CategoryChip } from '@/components/atoms';
import { formatDuration } from '@/utils/format';

/** Equirectangular projection onto the hero's canvas box. */
function project(lat: number, lon: number): { x: number; y: number } {
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

function HeroGlobe({ sounds }: { sounds: Sound[] }) {
  const points = useMemo(
    () =>
      sounds
        .filter((sound) => sound.place)
        .slice(0, 220)
        .map((sound) => {
          const { x, y } = project(sound.place!.lat, sound.place!.lon);
          return { x, y, color: CATEGORY_COLOR[sound.soundCategory] ?? '#4fd1b5', id: sound.id };
        }),
    [sounds],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMid slice" className="h-full w-full opacity-[0.55]">
        <defs>
          <radialGradient id="atlasGlow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="var(--bg)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="62" fill="url(#atlasGlow)" />
        {/* graticule */}
        {Array.from({ length: 13 }, (_, index) => index * 5).map((y) => (
          <line key={`lat-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="var(--border)" strokeWidth="0.08" />
        ))}
        {Array.from({ length: 19 }, (_, index) => index * 5.5).map((x) => (
          <line key={`lon-${x}`} x1={x} y1="0" x2={x} y2="62" stroke="var(--border)" strokeWidth="0.08" />
        ))}
        {points.map((point) => (
          <circle key={point.id} cx={point.x * 0.62} cy={point.y * 0.62} r="0.35" fill={point.color} opacity="0.9" />
        ))}
      </svg>
    </div>
  );
}

export function HomePage() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [featured, setFeatured] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const buffering = usePlayer((state) => state.buffering);
  const play = usePlayer((state) => state.play);
  const toggle = usePlayer((state) => state.toggle);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { entries } = await loadCatalog();
        if (cancelled) return;
        setCatalog(entries);
        // One representative sound per category keeps the front page varied.
        const byCategory = new Map<string, Sound>();
        for (const sound of entries) {
          if (!sound.place) continue;
          if (!byCategory.has(sound.soundCategory)) byCategory.set(sound.soundCategory, sound);
        }
        const picked = [...byCategory.values()].slice(0, 6);
        setFeatured(picked.length ? picked : entries.slice(0, 6));
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const places = new Set<string>();
    const countries = new Set<string>();
    for (const sound of catalog) {
      if (!sound.place) continue;
      places.add(`${sound.place.name}|${sound.place.lat.toFixed(1)}|${sound.place.lon.toFixed(1)}`);
      if (sound.place.country) countries.add(sound.place.country);
    }
    return { sounds: catalog.length, places: places.size, countries: countries.size };
  }, [catalog]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/explore?q=${encodeURIComponent(trimmed)}` : '/explore');
  };

  const playFeatured = (sound: Sound) => {
    if (currentId === sound.id) void toggle();
    else void play(sound, featured);
  };

  const startRandom = async () => {
    const result = await searchSounds({ limit: 20, seed: Date.now() % 100000 });
    if (result.items.length) {
      const picked = result.items[Math.floor(Math.random() * result.items.length)]!;
      navigate(`/sound/${encodeURIComponent(picked.id)}`);
      return;
    }
    navigate('/random');
  };

  return (
    <div>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <HeroGlobe sounds={catalog} />
        <div className="relative mx-auto max-w-[1400px] px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.22em]" style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}>
              <Globe2 size={12} />
              {t('home.eyebrow')}
            </div>
            <h1 className="mt-5 text-[clamp(40px,9vw,86px)] font-semibold leading-[0.92] tracking-[-0.03em]">
              SOUND
              <br />
              ATLAS
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed sm:text-[17px]" style={{ color: 'var(--text-dim)' }}>
              {t('brand.tagline')} {t('brand.line2')}
            </p>

            <form onSubmit={submit} className="mt-7 flex w-full max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('explore.searchPlaceholder')}
                  aria-label={t('explore.searchPlaceholder')}
                  className="focus-ring w-full rounded-full border px-4 py-3 text-[14px] outline-none placeholder:text-[var(--text-mute)]"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
                />
              </div>
              <button
                type="submit"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-medium"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {t('explore.search')}
                <ArrowRight size={14} />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to="/explore"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {t('home.cta.explore')}
              </Link>
              <button
                type="button"
                onClick={() => void startRandom()}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                <Shuffle size={12} />
                {t('home.cta.random')}
              </button>
              <Link
                to="/collections"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {t('home.cta.collections')}
              </Link>
              <Link
                to="/library"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {t('home.cta.map')}
              </Link>
            </div>

            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { value: stats.sounds, label: t('home.stat.sounds') },
                { value: stats.places, label: t('home.stat.places') },
                { value: stats.countries, label: t('home.stat.countries') },
              ].map((item) => (
                <div key={item.label}>
                  <dd className="font-mono text-[22px] font-semibold tabular-nums leading-none">
                    {loading ? '—' : item.value.toLocaleString()}
                  </dd>
                  <dt className="mt-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ featured */}
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">{t('home.featured')}</h2>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
              {t('home.featuredHint')}
            </p>
          </div>
          <Link to="/explore" className="focus-ring inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
            {t('nav.explore')}
            <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            <Loader2 size={14} className="animate-spin" />
            {t('explore.loading')}
          </div>
        ) : loadError ? (
          <p className="mt-6 text-[12.5px]" style={{ color: '#f87171' }}>
            {t('explore.error')}
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((sound) => {
              const isCurrent = currentId === sound.id;
              const isPlaying = isCurrent && playing;
              return (
                <article
                  key={sound.id}
                  className="group relative overflow-hidden rounded-xl border p-4"
                  style={{
                    borderColor: isCurrent ? 'color-mix(in srgb, var(--accent) 45%, var(--border))' : 'var(--border)',
                    background: 'var(--bg-raised)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => playFeatured(sound)}
                      className="focus-ring flex h-10 w-10 flex-none items-center justify-center rounded-full"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                      aria-label={isPlaying ? t('sound.pause') : t('sound.play')}
                    >
                      {isCurrent && buffering && !playing ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : isPlaying ? (
                        <Pause size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[13.5px] font-medium leading-snug">
                        <Link to={`/sound/${encodeURIComponent(sound.id)}`} className="hover:underline">
                          {sound.title}
                        </Link>
                      </h3>
                      <div className="mt-1 truncate text-[11.5px]" style={{ color: 'var(--text-mute)' }}>
                        {sound.place?.name}
                        {sound.place?.country ? ` · ${sound.place.country}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <CategoryChip category={sound.soundCategory} />
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-mute)' }}>
                      {formatDuration(sound.durationSec, lang)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- how it works */}
      <section className="border-y" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="max-w-2xl text-[clamp(22px,4vw,34px)] font-semibold leading-tight tracking-tight">
            {t('home.intro.title')}
          </h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {t('home.intro.body')}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { title: t('home.how.1.title'), body: t('home.how.1.body') },
              { title: t('home.how.2.title'), body: t('home.how.2.body') },
              { title: t('home.how.3.title'), body: t('home.how.3.body') },
            ].map((step, index) => (
              <div key={step.title} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <div className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                  0{index + 1}
                </div>
                <h3 className="mt-2 text-[14px] font-medium">{step.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-mute)' }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- recent picks */}
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold tracking-tight">{t('home.sources.title')}</h2>
            <div className="mt-4 flex min-w-0 flex-col gap-2.5">
              <SourceRow title={t('about.source.commons')} body={t('about.source.commonsBody')} tag="CC0 · PD · CC BY · CC BY-SA" />
              <SourceRow title={t('about.source.inat')} body={t('about.source.inatBody')} tag="CC0 · CC BY · CC BY-SA" />
              <SourceRow title={t('about.source.local')} body={t('about.source.localBody')} tag="IndexedDB" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold tracking-tight">{t('explore.results')}</h2>
            <div className="mt-4 flex flex-col gap-2">
              {featured.slice(0, 4).map((sound) => (
                <SoundCard key={sound.id} sound={sound} queue={featured} compact />
              ))}
            </div>
            <Link
              to="/explore"
              className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px]"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <Volume2 size={13} />
              {t('home.cta.explore')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourceRow({ title, body, tag }: { title: string; body: string; tag: string }) {
  return (
    <div className="min-w-0 rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="min-w-0 text-[13px] font-medium">{title}</h3>
        <span
          className="max-w-full break-words rounded-full border px-2 py-0.5 font-mono text-[10px] leading-5"
          style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
        >
          {tag}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--text-mute)' }}>
        {body}
      </p>
    </div>
  );
}
