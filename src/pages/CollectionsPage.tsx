/** Collections index — each card shows the real number of playable sounds it resolves to. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Play } from 'lucide-react';
import { resolveAllCollections, type ResolvedCollection } from '@/services/collections';
import { usePlayer } from '@/stores/playerStore';
import { useT } from '@/stores/uiStore';
import { CATEGORY_COLOR } from '@/types';
import { CategoryDot } from '@/components/atoms';
import { formatDuration } from '@/utils/format';

export function CollectionsPage() {
  const t = useT();
  const [resolved, setResolved] = useState<ResolvedCollection[] | null>(null);
  const play = usePlayer((state) => state.play);

  useEffect(() => {
    let cancelled = false;
    void resolveAllCollections(10).then((results) => {
      if (!cancelled) setResolved(results);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-5">
      <h1 className="text-[21px] font-semibold tracking-tight">{t('collections.title')}</h1>
      <p className="mt-1 max-w-2xl text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
        {t('collections.subtitle')}
      </p>

      {!resolved ? (
        <div className="mt-8 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
          <Loader2 size={14} className="animate-spin" />
          {t('explore.loading')}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resolved.map(({ collection, sounds }) => {
            const totalSeconds = sounds.reduce((sum, sound) => sum + (sound.durationSec ?? 0), 0);
            const lead = sounds[0];
            const color = lead ? CATEGORY_COLOR[lead.soundCategory] : 'var(--accent)';
            return (
              <article
                key={collection.id}
                className="flex flex-col rounded-xl border p-4 transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
              >
                <div
                  className="mb-3 flex h-24 items-end justify-between rounded-lg p-3"
                  style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${color} 26%, transparent), transparent 78%)` }}
                >
                  <div>
                    <h2 className="text-[15px] font-semibold leading-tight">{t(collection.titleKey)}</h2>
                    <div className="mt-1 font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
                      {t('collections.count', { n: sounds.length })}
                      {totalSeconds > 0 ? ` · ${formatDuration(totalSeconds, 'en')}` : ''}
                    </div>
                  </div>
                  {lead ? (
                    <button
                      type="button"
                      onClick={() => void play(lead, sounds)}
                      className="focus-ring flex h-9 w-9 flex-none items-center justify-center rounded-full"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                      aria-label={t('collections.playAll')}
                    >
                      <Play size={14} />
                    </button>
                  ) : null}
                </div>

                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-mute)' }}>
                  {t(collection.descriptionKey)}
                </p>

                {sounds.length ? (
                  <ul className="mt-3 flex flex-col gap-1">
                    {sounds.slice(0, 3).map((sound) => (
                      <li key={sound.id} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                        <CategoryDot category={sound.soundCategory} size={6} />
                        <span className="truncate">{sound.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[11.5px]" style={{ color: 'var(--warm)' }}>
                    {t('collections.empty')}
                  </p>
                )}

                <Link
                  to={`/collections/${collection.id}`}
                  className="focus-ring mt-3 inline-flex items-center gap-1 text-[11.5px]"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {t('collections.open')}
                  <ArrowRight size={11} />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
