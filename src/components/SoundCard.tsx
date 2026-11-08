/**
 * A compact sound card used across the home page, explore list and collections.
 * The play control is the whole card on touch, with an explicit button for keyboard.
 */
import { Link } from 'react-router-dom';
import { Loader2, Pause, Play } from 'lucide-react';
import { usePlayer } from '@/stores/playerStore';
import { useLang, useT } from '@/stores/uiStore';
import { CategoryChip, DurationChip } from '@/components/atoms';
import { formatDate } from '@/utils/format';
import type { Sound } from '@/types';

export interface SoundCardProps {
  sound: Sound;
  queue?: Sound[];
  compact?: boolean;
}

export function SoundCard({ sound, queue, compact = false }: SoundCardProps) {
  const t = useT();
  const lang = useLang();
  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const buffering = usePlayer((state) => state.buffering);
  const play = usePlayer((state) => state.play);
  const toggle = usePlayer((state) => state.toggle);

  const isCurrent = currentId === sound.id;
  const isPlaying = isCurrent && playing;

  const onPlay = () => {
    if (isCurrent) void toggle();
    else void play(sound, queue);
  };

  return (
    <article
      className="group flex min-w-0 items-start gap-3 rounded-xl border p-3 transition-colors"
      style={{
        borderColor: isCurrent ? 'color-mix(in srgb, var(--accent) 45%, var(--border))' : 'var(--border)',
        background: isCurrent ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-raised))' : 'var(--bg-raised)',
      }}
    >
      <button
        type="button"
        onClick={onPlay}
        className="focus-ring mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full"
        style={{ background: isCurrent ? 'var(--accent)' : 'var(--bg-panel)', color: isCurrent ? 'var(--accent-ink)' : 'var(--text-dim)', border: '1px solid var(--border)' }}
        aria-label={isPlaying ? t('sound.pause') : t('sound.play')}
      >
        {isCurrent && buffering && !playing ? <Loader2 size={14} className="animate-spin" /> : isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <div className="min-w-0 flex-1">
        <Link to={`/sound/${encodeURIComponent(sound.id)}`} className="focus-ring line-clamp-2 rounded text-[13px] font-medium leading-snug hover:underline">
          {sound.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--text-mute)' }}>
          <span className="truncate">
            {sound.place ? `${sound.place.name}${sound.place.country ? ` · ${sound.place.country}` : ''}` : t('common.unknown')}
          </span>
          <span aria-hidden>·</span>
          <DurationChip seconds={sound.durationSec} />
          {sound.recordedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>{formatDate(sound.recordedAt, lang)}</span>
            </>
          ) : null}
        </div>
        {!compact ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CategoryChip category={sound.soundCategory} />
            <span className="text-[10px]" style={{ color: 'var(--text-mute)' }}>
              {sound.source === 'commons' ? 'Wikimedia Commons' : sound.source === 'inaturalist' ? 'iNaturalist' : 'Local'} ·{' '}
              {sound.licence.code.toUpperCase()}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
