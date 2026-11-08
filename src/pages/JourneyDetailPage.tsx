/**
 * One journey: an ordered listening route through real places.
 *
 * Playback walks the route in order and stops at the end; skipping a stop updates the
 * highlighted position so the shown state always matches what is playing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Pause, Play, Square, Trash2 } from 'lucide-react';
import { useT, useUi } from '@/stores/uiStore';
import { usePlayer } from '@/stores/playerStore';
import { putJourney } from '@/services/storage';
import { CategoryDot } from '@/components/atoms';
import { formatDuration } from '@/utils/format';
import type { Sound } from '@/types';

export function JourneyDetailPage() {
  const { id = '' } = useParams();
  const t = useT();
  const journeys = useUi((state) => state.journeys);
  const saved = useUi((state) => state.saved);
  const refreshJourneys = useUi((state) => state.refreshJourneys);
  const notify = useUi((state) => state.notify);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const play = usePlayer((state) => state.play);
  const toggle = usePlayer((state) => state.toggle);
  const stop = usePlayer((state) => state.stop);
  const playing = usePlayer((state) => state.playing);
  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);

  const journey = journeys.find((entry) => entry.id === id);

  useEffect(() => {
    // `journeys` hydrates asynchronously, so wait one tick before declaring it missing.
    const timer = setTimeout(() => setState(journey ? 'ready' : 'missing'), 250);
    return () => clearTimeout(timer);
  }, [journey]);

  const sounds: Sound[] = useMemo(() => {
    if (!journey) return [];
    return journey.itemIds
      .map((soundId) => saved.find((row) => row.id === soundId)?.sound)
      .filter((sound): sound is Sound => Boolean(sound));
  }, [journey, saved]);

  const totalSeconds = sounds.reduce((sum, sound) => sum + (sound.durationSec ?? 0), 0);

  const move = async (index: number, direction: -1 | 1) => {
    if (!journey) return;
    const target = index + direction;
    if (target < 0 || target >= journey.itemIds.length) return;
    const next = [...journey.itemIds];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    await putJourney({ ...journey, itemIds: next, updatedAt: new Date().toISOString() });
    await refreshJourneys();
  };

  const remove = async (index: number) => {
    if (!journey) return;
    const next = journey.itemIds.filter((_, position) => position !== index);
    await putJourney({ ...journey, itemIds: next, updatedAt: new Date().toISOString() });
    await refreshJourneys();
  };

  if (state === 'missing' || !journey) {
    return (
      <div className="mx-auto max-w-[820px] px-3 py-10 sm:px-5">
        {state === 'loading' ? (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-mute)' }}>
            <Loader2 size={14} className="animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <>
            <h1 className="text-[18px] font-semibold">{t('error.notFound')}</h1>
            <Link to="/journeys" className="mt-3 inline-block text-[12.5px] underline" style={{ color: 'var(--text-dim)' }}>
              {t('journeys.title')}
            </Link>
          </>
        )}
      </div>
    );
  }

  const activeIndex = sounds.findIndex((sound) => sound.id === currentId);

  return (
    <div className="mx-auto max-w-[900px] px-3 py-5 sm:px-5">
      <Link to="/journeys" className="focus-ring inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-mute)' }}>
        <ArrowLeft size={13} />
        {t('journeys.title')}
      </Link>

      <header className="mt-3">
        <h1 className="text-[22px] font-semibold tracking-tight">{journey.title}</h1>
        {journey.description ? (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {journey.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
          <span>{t('maps.items', { n: sounds.length })}</span>
          {totalSeconds ? <span>· {t('journeys.total')} {formatDuration(totalSeconds, 'en')}</span> : null}
          <span>· {t('journeys.notNavigation')}</span>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {sounds.length ? (
          <>
            <button
              type="button"
              onClick={() => void (activeIndex >= 0 ? toggle() : play(sounds[0]!, sounds))}
              className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {activeIndex >= 0 && playing ? <Pause size={13} /> : <Play size={13} />}
              {activeIndex >= 0 && playing ? t('sound.pause') : t('journeys.play')}
            </button>
            {activeIndex >= 0 ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  notify(t('journeys.stop'));
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                <Square size={11} />
                {t('journeys.stop')}
              </button>
            ) : null}
            {activeIndex >= 0 ? (
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {t('journeys.position', { n: activeIndex + 1, total: sounds.length })}
              </span>
            ) : null}
          </>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('maps.empty')}
          </p>
        )}
      </div>

      <ol className="mt-5 flex flex-col gap-2">
        {sounds.map((sound, index) => {
          const isActive = sound.id === currentId;
          return (
            <li
              key={sound.id}
              className="flex items-start gap-2 rounded-xl border p-3"
              style={{
                borderColor: isActive ? 'color-mix(in srgb, var(--accent) 45%, var(--border))' : 'var(--border)',
                background: isActive ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-raised))' : 'var(--bg-raised)',
              }}
            >
              <span className="mt-0.5 w-5 flex-none text-center font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void play(sound, sounds)}
                  className="focus-ring block w-full truncate rounded text-left text-[13px] font-medium hover:underline"
                >
                  {sound.title}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--text-mute)' }}>
                  <CategoryDot category={sound.soundCategory} size={6} />
                  <span className="truncate">
                    {sound.place?.name}
                    {sound.place?.country ? ` · ${sound.place.country}` : ''}
                  </span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{formatDuration(sound.durationSec, 'en')}</span>
                </div>
              </div>
              <div className="flex flex-none items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  className="focus-ring rounded p-1 disabled:opacity-30"
                  style={{ color: 'var(--text-mute)' }}
                  aria-label={t('journeys.moveUp')}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void move(index, 1)}
                  disabled={index === sounds.length - 1}
                  className="focus-ring rounded p-1 disabled:opacity-30"
                  style={{ color: 'var(--text-mute)' }}
                  aria-label={t('journeys.moveDown')}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(index)}
                  className="focus-ring rounded p-1"
                  style={{ color: 'var(--text-mute)' }}
                  aria-label={t('library.delete')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {sounds.length < journey.itemIds.length ? (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--warm)' }}>
          {t('library.empty.saved')}
        </p>
      ) : null}
    </div>
  );
}
