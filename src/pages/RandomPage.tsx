/**
 * Random sound — "Take me somewhere".
 *
 * A random pick is a seeded shuffle over sounds that are actually loadable now. If the
 * chosen file fails to load, the page advances to the next candidate instead of showing
 * a broken player.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dices, ExternalLink, Loader2, Pause, Play, RefreshCw, Shuffle } from 'lucide-react';
import { searchSounds } from '@/services/soundService';
import { usePlayer } from '@/stores/playerStore';
import { useLang, useT } from '@/stores/uiStore';
import { CategoryChip, LicenceLink } from '@/components/atoms';
import { formatDuration } from '@/utils/format';
import type { Sound, SoundCategory } from '@/types';

const SCOPES: { key: string; categories?: SoundCategory[]; taxonId?: number }[] = [
  { key: 'random.scope.all' },
  { key: 'random.scope.animal', categories: ['animal'] },
  { key: 'random.scope.nature', categories: ['nature', 'rain', 'weather', 'water'] },
  { key: 'random.scope.city', categories: ['city', 'traffic', 'transport', 'human'] },
];

export function RandomPage() {
  const t = useT();
  const lang = useLang();
  const [scopeIndex, setScopeIndex] = useState(0);
  const [sound, setSound] = useState<Sound | null>(null);
  const [pool, setPool] = useState<Sound[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle');
  const [error, setError] = useState<string | null>(null);

  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const playerError = usePlayer((state) => state.error);
  const play = usePlayer((state) => state.play);
  const toggle = usePlayer((state) => state.toggle);

  const draw = useCallback(
    async (advance = 0) => {
      setState('loading');
      setError(null);
      setSound(null);
      const scope = SCOPES[scopeIndex]!;
      const seed = Math.floor(Math.random() * 1_000_000);
      const result = await searchSounds({
        categories: scope.categories,
        limit: 60,
        seed,
      });
      if (!result.items.length) {
        setState('empty');
        setError(result.errors[0] ?? null);
        return;
      }
      setPool(result.items);
      const pick = result.items[Math.min(advance, result.items.length - 1)] ?? result.items[0]!;
      setSound(pick);
      setState('ready');
      await play(pick, result.items);
    },
    [scopeIndex, play],
  );

  // If the picked file cannot be played, move to the next candidate rather than lying.
  useEffect(() => {
    if (!playerError || !sound || currentId !== sound.id) return;
    const index = pool.findIndex((entry) => entry.id === sound.id);
    const nextCandidate = pool[index + 1];
    if (nextCandidate) {
      setSound(nextCandidate);
      void play(nextCandidate, pool);
    } else {
      setState('empty');
    }
  }, [playerError, sound, currentId, pool, play]);

  const isCurrent = sound != null && currentId === sound.id;

  return (
    <div className="mx-auto flex max-w-[820px] flex-col px-3 py-8 sm:px-5 sm:py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.22em]" style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}>
          <Dices size={12} />
          {t('random.title')}
        </div>
        <h1 className="mt-4 text-[clamp(26px,6vw,44px)] font-semibold leading-tight tracking-tight">{t('brand.line2')}</h1>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
        {SCOPES.map((scope, index) => (
          <button
            key={scope.key}
            type="button"
            onClick={() => {
              setScopeIndex(index);
              setState('idle');
              setSound(null);
            }}
            className="focus-ring rounded-full border px-2.5 py-1 text-[11.5px]"
            style={{
              borderColor: scopeIndex === index ? 'var(--accent)' : 'var(--border)',
              color: scopeIndex === index ? 'var(--text)' : 'var(--text-mute)',
            }}
            aria-pressed={scopeIndex === index}
          >
            {t(scope.key)}
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
        {state === 'idle' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="max-w-sm text-center text-[13px]" style={{ color: 'var(--text-mute)' }}>
              {t('random.scope')} · {t(SCOPES[scopeIndex]!.key)}
            </p>
            <button
              type="button"
              onClick={() => void draw()}
              className="focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <Shuffle size={14} />
              {t('random.pick')}
            </button>
          </div>
        ) : state === 'loading' ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-mute)' }}>
              {t('random.loading')}
            </p>
          </div>
        ) : state === 'empty' ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-[13px]" style={{ color: 'var(--warm)' }}>
              {t('random.empty')}
            </p>
            {error ? (
              <p className="max-w-md text-center text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void draw()}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              <RefreshCw size={12} />
              {t('explore.retry')}
            </button>
          </div>
        ) : sound ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold leading-snug">{sound.title}</h2>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
                  {sound.place?.name}
                  {sound.place?.country ? ` · ${sound.place.country}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void (isCurrent ? toggle() : play(sound, pool))}
                className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {isCurrent && playing ? <Pause size={13} /> : <Play size={13} />}
                {isCurrent && playing ? t('sound.pause') : t('sound.play')}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CategoryChip category={sound.soundCategory} />
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {formatDuration(sound.durationSec, lang)}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {sound.author}
              </span>
              <LicenceLink sound={sound} />
            </div>

            {sound.description ? (
              <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {sound.description}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void draw()}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px]"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                <Shuffle size={13} />
                {t('random.again')}
              </button>
              <Link
                to={`/sound/${encodeURIComponent(sound.id)}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {t('sound.share')}
              </Link>
              <a
                href={sound.pageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                <ExternalLink size={12} />
                {t('sound.openOriginal')}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
