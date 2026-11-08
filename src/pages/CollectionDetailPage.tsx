/** One collection: the real list of sounds it resolves to, with a play-all control. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { collectionById, resolveCollection, type ResolvedCollection } from '@/services/collections';
import { SoundCard } from '@/components/SoundCard';
import { usePlayer } from '@/stores/playerStore';
import { useT } from '@/stores/uiStore';
import { formatDuration } from '@/utils/format';

export function CollectionDetailPage() {
  const { id = '' } = useParams();
  const t = useT();
  const play = usePlayer((state) => state.play);
  const collection = collectionById(id);
  const [resolved, setResolved] = useState<ResolvedCollection | null>(null);
  const [notFound, setNotFound] = useState(!collection);

  useEffect(() => {
    if (!collection) {
      setNotFound(true);
      return;
    }
    let cancelled = false;
    void resolveCollection(collection, 40).then((result) => {
      if (!cancelled) setResolved(result);
    });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  if (notFound || !collection) {
    return (
      <div className="mx-auto max-w-[820px] px-3 py-10 sm:px-5">
        <h1 className="text-[18px] font-semibold">{t('error.notFound')}</h1>
        <Link to="/collections" className="mt-3 inline-block text-[12.5px] underline" style={{ color: 'var(--text-dim)' }}>
          {t('collections.title')}
        </Link>
      </div>
    );
  }

  const sounds = resolved?.sounds ?? [];
  const totalSeconds = sounds.reduce((sum, sound) => sum + (sound.durationSec ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-5 sm:px-5">
      <Link to="/collections" className="focus-ring inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-mute)' }}>
        <ArrowLeft size={13} />
        {t('collections.title')}
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{t(collection.titleKey)}</h1>
          <p className="mt-1 max-w-xl text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t(collection.descriptionKey)}
          </p>
          <div className="mt-2 flex items-center gap-3 font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
            <span>{t('collections.count', { n: sounds.length })}</span>
            {totalSeconds ? <span>· {formatDuration(totalSeconds, 'en')}</span> : null}
          </div>
        </div>
        {sounds.length ? (
          <button
            type="button"
            onClick={() => void play(sounds[0]!, sounds)}
            className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            <Play size={13} />
            {t('collections.playAll')}
          </button>
        ) : null}
      </header>

      {!resolved ? (
        <div className="mt-8 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
          <Loader2 size={14} className="animate-spin" />
          {t('explore.loading')}
        </div>
      ) : sounds.length ? (
        <div className="mt-5 grid min-w-0 gap-2 sm:grid-cols-2">
          {sounds.map((sound) => (
            <SoundCard key={sound.id} sound={sound} queue={sounds} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-[12.5px]" style={{ color: 'var(--warm)' }}>
          {t('collections.empty')}
        </p>
      )}
    </div>
  );
}
