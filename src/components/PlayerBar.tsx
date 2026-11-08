/**
 * The persistent player bar.
 *
 * Desktop: a compact horizontal strip. Mobile: a two-row dock that keeps the primary
 * controls within thumb reach and never covers the map controls.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Gauge,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer, cycleRate } from '@/stores/playerStore';
import { audioEngine } from '@/services/audioEngine';
import { useLang, useT } from '@/stores/uiStore';
import { Waveform } from '@/components/Waveform';
import { CategoryDot } from '@/components/atoms';
import { formatClock } from '@/utils/format';

export function PlayerBar() {
  const t = useT();
  const lang = useLang();
  const {
    queue,
    index,
    playing,
    buffering,
    currentTime,
    duration,
    error,
    volume,
    muted,
    loop,
    rate,
    canAnalyse,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleLoop,
    setRate,
    retry,
    stop,
    setAmbient,
  } = usePlayer();

  const sound = queue[index]?.sound ?? null;
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const lastFetch = useRef<string | null>(null);

  // Pull the analyser out of the engine once a load settles.
  useEffect(() => {
    const id = sound?.id ?? null;
    if (id !== lastFetch.current) {
      lastFetch.current = id;
      setAnalyser(null);
    }
    if (!sound) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setAnalyser(audioEngine.analyserNode);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sound, canAnalyse]);

  if (!sound) return null;

  const position = scrub ?? currentTime;
  const shownDuration = duration || sound.durationSec || 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[900] border-t backdrop-blur-xl"
      style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-raised) 92%, transparent)' }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-2.5">
        {/* ---- identity */}
        <div className="flex min-w-0 items-center gap-2.5 sm:w-[240px]">
          <div className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <CategoryDot category={sound.soundCategory} size={10} />
            {playing ? <span className="pulse-ring absolute inset-0 rounded-lg" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/sound/${encodeURIComponent(sound.id)}`} className="block truncate text-[13px] font-medium hover:underline">
              {sound.title}
            </Link>
            <div className="truncate text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {sound.place ? `${sound.place.name}${sound.place.country ? `, ${sound.place.country}` : ''}` : t('common.unknown')}
            </div>
          </div>
          <button
            type="button"
            onClick={stop}
            className="focus-ring flex-none rounded-full p-1.5 sm:hidden"
            style={{ color: 'var(--text-mute)' }}
            aria-label={t('player.close')}
          >
            <X size={15} />
          </button>
        </div>

        {/* ---- transport */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          <button type="button" onClick={previous} className="focus-ring rounded-full p-2" style={{ color: 'var(--text-dim)' }} aria-label={t('player.previous')}>
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            aria-label={playing ? t('sound.pause') : t('sound.play')}
          >
            {buffering && !playing ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" onClick={next} className="focus-ring rounded-full p-2" style={{ color: 'var(--text-dim)' }} aria-label={t('player.next')}>
            <SkipForward size={16} />
          </button>
        </div>

        {/* ---- waveform + time */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden flex-none font-mono text-[11px] tabular-nums sm:inline" style={{ color: 'var(--text-mute)' }}>
            {formatClock(position)}
          </span>
          <div className="min-w-0 flex-1">
            {error ? (
              <div className="flex items-center gap-2 text-[11px]" style={{ color: '#f87171' }}>
                <AlertTriangle size={13} />
                <span className="truncate">{t('sound.failed')}</span>
                <button type="button" onClick={retry} className="underline">
                  {t('sound.retry')}
                </button>
              </div>
            ) : (
              <Waveform
                analyser={analyser}
                playing={playing}
                duration={shownDuration}
                currentTime={position}
                onSeek={(seconds) => {
                  seek(seconds);
                  setScrub(null);
                }}
                seed={sound.id}
                height={34}
                bars={72}
              />
            )}
          </div>
          <span className="hidden flex-none font-mono text-[11px] tabular-nums sm:inline" style={{ color: 'var(--text-mute)' }}>
            {formatClock(shownDuration)}
          </span>
        </div>

        {/* ---- extras */}
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => setRate(cycleRate(rate))}
            className="focus-ring flex items-center gap-1 rounded-full px-2 py-1.5 font-mono text-[11px]"
            style={{ color: rate === 1 ? 'var(--text-mute)' : 'var(--accent)' }}
            aria-label={t('player.speed')}
            title={t('player.speed')}
          >
            <Gauge size={14} />
            {rate}×
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            className="focus-ring rounded-full p-2"
            style={{ color: loop ? 'var(--accent)' : 'var(--text-mute)' }}
            aria-pressed={loop}
            aria-label={t('player.loop')}
            title={t('player.loop')}
          >
            <Repeat size={14} />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="focus-ring rounded-full p-2"
              style={{ color: 'var(--text-mute)' }}
              aria-label={muted ? t('player.unmute') : t('player.mute')}
            >
              {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="range w-16"
              aria-label={t('player.volume')}
            />
          </div>
          <button
            type="button"
            onClick={() => setAmbient(true)}
            className="focus-ring rounded-full p-2"
            style={{ color: 'var(--text-mute)' }}
            title={t('sound.ambient')}
            aria-label={t('sound.ambient')}
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            onClick={stop}
            className="focus-ring hidden rounded-full p-2 lg:block"
            style={{ color: 'var(--text-mute)' }}
            aria-label={t('player.close')}
            title={t('player.close')}
          >
            <X size={14} />
          </button>
        </div>

        {/* ---- mobile secondary row */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-mute)' }}>
            {formatClock(position)} / {formatClock(shownDuration)}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setRate(cycleRate(rate))} className="rounded-full px-2 py-1 font-mono text-[11px]" style={{ color: rate === 1 ? 'var(--text-mute)' : 'var(--accent)' }}>
              {rate}×
            </button>
            <button type="button" onClick={toggleLoop} className="rounded-full p-1.5" style={{ color: loop ? 'var(--accent)' : 'var(--text-mute)' }} aria-pressed={loop} aria-label={t('player.loop')}>
              <Repeat size={14} />
            </button>
            <button type="button" onClick={() => setAmbient(true)} className="rounded-full p-1.5" style={{ color: 'var(--text-mute)' }} aria-label={t('sound.ambient')}>
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {playing ? `${t('player.nowPlaying')}: ${sound.title}` : ''} {lang === 'zh' ? '' : ''}
      </span>
    </div>
  );
}
