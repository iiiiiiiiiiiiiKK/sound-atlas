/** One personal sound map: rename, describe, play and prune its sounds. */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Play, Trash2 } from 'lucide-react';
import { useT, useUi } from '@/stores/uiStore';
import { usePlayer } from '@/stores/playerStore';
import { deleteMap, putMap } from '@/services/storage';
import { SoundCard } from '@/components/SoundCard';
import type { Sound } from '@/types';

export function MapDetailPage() {
  const { id = '' } = useParams();
  const t = useT();
  const maps = useUi((state) => state.maps);
  const saved = useUi((state) => state.saved);
  const refreshMaps = useUi((state) => state.refreshMaps);
  const notify = useUi((state) => state.notify);
  const play = usePlayer((state) => state.play);

  const map = maps.find((entry) => entry.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(map?.title ?? '');
  const [description, setDescription] = useState(map?.description ?? '');

  const sounds: Sound[] = useMemo(() => {
    if (!map) return [];
    return map.itemIds
      .map((soundId) => saved.find((row) => row.id === soundId)?.sound)
      .filter((sound): sound is Sound => Boolean(sound));
  }, [map, saved]);

  if (!map) {
    return (
      <div className="mx-auto max-w-[820px] px-3 py-10 sm:px-5">
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-mute)' }}>
          <Loader2 size={14} className="animate-spin" />
          {t('common.loading')}
        </div>
        <Link to="/library" className="mt-3 inline-block text-[12.5px] underline" style={{ color: 'var(--text-dim)' }}>
          {t('library.title')}
        </Link>
      </div>
    );
  }

  const save = async () => {
    await putMap({
      ...map,
      title: title.trim() || map.title,
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    });
    await refreshMaps();
    setEditing(false);
    notify(t('common.save'), 'success');
  };

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-5 sm:px-5">
      <Link to="/library" className="focus-ring inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-mute)' }}>
        <ArrowLeft size={13} />
        {t('library.title')}
      </Link>

      <header className="mt-3">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="focus-ring rounded-lg border px-3 py-2 text-[15px] outline-none"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="focus-ring resize-y rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px]"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                <Check size={12} />
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="focus-ring rounded-full border px-3 py-1.5 text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
              >
                {t('maps.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">{map.title}</h1>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTitle(map.title);
                    setDescription(map.description);
                    setEditing(true);
                  }}
                  className="focus-ring rounded-full border px-2.5 py-1.5 text-[11.5px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  {t('library.rename')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(t('library.deleteConfirm', { name: map.title }))) return;
                    await deleteMap(map.id);
                    await refreshMaps();
                  }}
                  className="focus-ring rounded-full border p-1.5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
                  aria-label={t('library.delete')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {map.description ? (
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {map.description}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {t('maps.items', { n: sounds.length })} · {t('maps.private.Note')}
            </p>
          </>
        )}
      </header>

      {sounds.length ? (
        <>
          <button
            type="button"
            onClick={() => void play(sounds[0]!, sounds)}
            className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            <Play size={13} />
            {t('collections.playAll')}
          </button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {sounds.map((sound) => (
              <SoundCard key={sound.id} sound={sound} queue={sounds} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-6 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
          {t('maps.empty')}
        </p>
      )}
    </div>
  );
}
