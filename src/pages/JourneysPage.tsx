/** Journeys index — create and open listening routes. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Waypoints } from 'lucide-react';
import { useT, useUi, useLang } from '@/stores/uiStore';
import { deleteJourney, putJourney } from '@/services/storage';
import { newId, relativeTime } from '@/utils/format';

export function JourneysPage() {
  const t = useT();
  const lang = useLang();
  const journeys = useUi((state) => state.journeys);
  const saved = useUi((state) => state.saved);
  const refreshJourneys = useUi((state) => state.refreshJourneys);
  const notify = useUi((state) => state.notify);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    await putJourney({
      id: newId('journey'),
      title: trimmed,
      description: description.trim(),
      itemIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await refreshJourneys();
    setTitle('');
    setDescription('');
    setCreating(false);
    notify(t('journeys.new'), 'success');
  };

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-5 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">{t('journeys.title')}</h1>
          <p className="mt-1 max-w-xl text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('journeys.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <Plus size={13} />
          {t('journeys.new')}
        </button>
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--text-mute)' }}>
        {t('journeys.notNavigation')}
      </p>

      {creating ? (
        <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
          <label className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('maps.name')}
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }}
            placeholder={t('maps.name')}
          />
          <label className="mt-3 block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('maps.description')} · {t('common.optional')}
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="focus-ring mt-1 w-full resize-y rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!title.trim()}
              className="focus-ring rounded-full px-3 py-1.5 text-[12px] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {t('maps.create')}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="focus-ring rounded-full border px-3 py-1.5 text-[12px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
            >
              {t('maps.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {journeys.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {journeys.map((journey) => {
            const playable = journey.itemIds.filter((id) => saved.some((row) => row.id === id)).length;
            return (
              <div key={journey.id} className="rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/journeys/${journey.id}`} className="text-[13.5px] font-medium hover:underline">
                      {journey.title}
                    </Link>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-mute)' }}>
                      {t('maps.items', { n: journey.itemIds.length })} · {relativeTime(journey.updatedAt, lang)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(t('library.deleteConfirm', { name: journey.title }))) return;
                      await deleteJourney(journey.id);
                      await refreshJourneys();
                    }}
                    className="focus-ring rounded-full p-1.5"
                    style={{ color: 'var(--text-mute)' }}
                    aria-label={t('library.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {describeStops(journey.itemIds.length, playable)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <Waypoints size={18} style={{ color: 'var(--text-mute)' }} />
          <p className="text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('library.empty.journeys')}
          </p>
        </div>
      )}
    </div>
  );
}

function describeStops(total: number, playable: number) {
  if (!total) return null;
  return (
    <div className="mt-2 font-mono text-[10.5px]" style={{ color: 'var(--text-mute)' }}>
      {playable}/{total}
    </div>
  );
}
