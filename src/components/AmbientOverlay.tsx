/**
 * Ambient mode — a full-screen listening view.
 *
 * Deliberately quiet: one large place name, one waveform, and only the controls that
 * matter while listening (loop, sleep timer, next). Everything else is hidden behind a
 * single close control so nothing competes with the recording.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Pause, Play, Repeat, SkipForward, Timer } from 'lucide-react';
import { usePlayer } from '@/stores/playerStore';
import { audioEngine } from '@/services/audioEngine';
import { useLang, useT } from '@/stores/uiStore';
import { Waveform } from '@/components/Waveform';
import { formatClock, formatDuration } from '@/utils/format';
import { CATEGORY_COLOR } from '@/types';
import { useCategoryLabel } from '@/components/atoms';

const TIMERS = [5, 15, 30, 60];

export function AmbientOverlay() {
  const t = useT();
  const lang = useLang();
  const categoryLabel = useCategoryLabel();
  const {
    ambient,
    queue,
    index,
    playing,
    currentTime,
    duration,
    canAnalyse,
    error,
    loop,
    autoAdvance,
    sleepTimerMinutes,
    setAmbient,
    setAutoAdvance,
    setSleepTimer,
    toggle,
    next,
    seek,
    stop,
    toggleLoop,
  } = usePlayer();

  const sound = queue[index]?.sound ?? null;
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!ambient || !sound) return;
    setAnalyser(null);
    const timer = setTimeout(() => setAnalyser(audioEngine.analyserNode), 400);
    return () => clearTimeout(timer);
  }, [ambient, sound, canAnalyse]);

  useEffect(() => {
    if (!ambient) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAmbient(false);
      if (event.code === 'Space') {
        event.preventDefault();
        void toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ambient, setAmbient, toggle]);

  if (!ambient || !sound) return null;

  const length = duration || sound.durationSec || 0;
  const accent = CATEGORY_COLOR[sound.soundCategory] ?? 'var(--accent)';

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col"
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${accent} 14%, var(--bg)) 0%, var(--bg) 62%)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('ambient.title')}
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-8">
        <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: 'var(--text-mute)' }}>
          {t('ambient.title')}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSleepTimer(sleepTimerMinutes ? null : 30)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px]"
            style={{
              borderColor: sleepTimerMinutes ? accent : 'var(--border)',
              color: sleepTimerMinutes ? accent : 'var(--text-mute)',
            }}
            aria-label={t('ambient.timer')}
            title={t('ambient.timer')}
          >
            <Timer size={13} />
            {sleepTimerMinutes ? `${sleepTimerMinutes}m` : t('ambient.timerOff')}
          </button>
          <button
            type="button"
            onClick={() => setAmbient(false)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <ChevronDown size={14} />
            {t('ambient.exit')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="mb-3 text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>
          {categoryLabel(sound.soundCategory)}
        </div>
        <h1 className="max-w-4xl text-[clamp(26px,6vw,64px)] font-semibold leading-[1.05] tracking-tight">
          {sound.place?.name ?? sound.title}
        </h1>
        {sound.place?.country ? (
          <div className="mt-2 text-[13px] sm:text-[15px]" style={{ color: 'var(--text-dim)' }}>
            {sound.place.country}
          </div>
        ) : null}
        <p className="mt-4 max-w-xl text-[13px] leading-relaxed" style={{ color: 'var(--text-mute)' }}>
          {sound.title}
          {sound.author ? ` · ${sound.author}` : ''}
        </p>

        <div className="mt-8 w-full max-w-3xl">
          {error ? (
            <div className="text-[13px]" style={{ color: '#f87171' }}>
              {t('sound.failed')}
            </div>
          ) : (
            <Waveform
              analyser={analyser}
              playing={playing}
              duration={length}
              currentTime={currentTime}
              onSeek={seek}
              seed={sound.id}
              height={140}
              bars={96}
              color={accent}
            />
          )}
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-mute)' }}>
            <span>{formatClock(currentTime)}</span>
            <span>{formatClock(length)}</span>
          </div>
          {!canAnalyse ? (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {t('sound.noCors')}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="focus-ring flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accent, color: '#04120f' }}
            aria-label={playing ? t('sound.pause') : t('sound.play')}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            type="button"
            onClick={next}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            aria-label={t('player.next')}
          >
            <SkipForward size={17} />
          </button>
          <button
            type="button"
            onClick={() => toggleLoop()}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border"
            style={{
              borderColor: loop ? accent : 'var(--border)',
              color: loop ? accent : 'var(--text-dim)',
            }}
            aria-pressed={loop}
            aria-label={t('player.loop')}
          >
            <Repeat size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--text-mute)' }}>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(event) => setAutoAdvance(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            {t('ambient.autoplay')}
          </label>
          <span aria-hidden>·</span>
          {TIMERS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setSleepTimer(sleepTimerMinutes === minutes ? null : minutes)}
              className="rounded-full border px-2 py-0.5"
              style={{
                borderColor: sleepTimerMinutes === minutes ? accent : 'var(--border)',
                color: sleepTimerMinutes === minutes ? accent : 'var(--text-mute)',
              }}
            >
              {minutes}m
            </button>
          ))}
          <span aria-hidden>·</span>
          <span>{formatDuration(length, lang)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={() => {
            stop();
            setAmbient(false);
          }}
          className="text-[11px] underline decoration-dotted underline-offset-4"
          style={{ color: 'var(--text-mute)' }}
        >
          {t('player.close')}
        </button>
      </div>
    </div>
  );
}
