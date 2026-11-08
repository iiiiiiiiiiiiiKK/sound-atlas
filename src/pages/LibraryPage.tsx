/**
 * Library 鈥?everything the user owns, all of it local.
 *
 * Tabs: saved sounds, recent plays, sound maps, own recordings, journeys. Export and
 * import are here so a user can move their data between browsers.
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Loader2,
  Pencil,
  Play,
  Trash2,
  Upload as UploadIcon,
  Waypoints,
} from 'lucide-react';
import { useLang, useT, useUi } from '@/stores/uiStore';
import { usePlayer } from '@/stores/playerStore';
import * as storage from '@/services/storage';
import { deleteClip, deleteJourney, deleteMap, clearHistory } from '@/services/storage';
import { SoundCard } from '@/components/SoundCard';
import { formatDuration, relativeTime } from '@/utils/format';
import type { Sound } from '@/types';

type Tab = 'saved' | 'recent' | 'maps' | 'clips' | 'journeys';

/** A locally stored clip can be played through an object URL. */
function clipToSound(clip: storage.ClipRow): Sound {
  return {
    id: clip.id,
    source: 'local',
    title: clip.title,
    description: clip.description,
    audioUrl: URL.createObjectURL(clip.blob),
    pageUrl: '',
    mime: clip.mime,
    durationSec: clip.durationSec,
    licence: { code: 'your own recording', url: '', attributionRequired: false, shareAlike: false },
    author: 'You',
    soundCategory: clip.soundCategory,
    place:
      clip.lat != null && clip.lon != null
        ? { name: clip.placeName, country: clip.country, lat: clip.lat, lon: clip.lon, precision: 'user' }
        : null,
    recordedAt: clip.recordedAt,
    canAnalyse: true,
    attribution: `${clip.title} 鈥?your own recording`,
  };
}

export function LibraryPage() {
  const t = useT();
  const lang = useLang();
  const notify = useUi((state) => state.notify);
  const { saved, history, maps, clips, journeys, refreshSaved, refreshMaps, refreshJourneys, refreshClips, refreshHistory } = useUi();
  const play = usePlayer((state) => state.play);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<Tab>('saved');
  const [busy, setBusy] = useState(false);

  const savedSounds = useMemo(() => saved.map((row) => row.sound), [saved]);
  const historySounds = useMemo(() => history.map((row) => row.sound), [history]);

  const exportData = async () => {
    setBusy(true);
    try {
      const bundle = await storage.exportBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sound-atlas-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      notify(t('library.importFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await storage.importBundle(parsed);
      await Promise.all([refreshSaved(), refreshMaps(), refreshJourneys(), refreshClips()]);
      notify(t('library.importDone', { added: result.added, skipped: result.skipped }), 'success');
    } catch {
      notify(t('library.importFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'saved', label: t('library.tab.saved'), count: saved.length },
    { key: 'recent', label: t('library.tab.recent'), count: history.length },
    { key: 'maps', label: t('library.tab.maps'), count: maps.length },
    { key: 'clips', label: t('library.tab.clips'), count: clips.length },
    { key: 'journeys', label: t('library.tab.journeys'), count: journeys.length },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-5 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">{t('library.title')}</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('library.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void exportData()}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] disabled:opacity-60"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            title={t('library.exportHint')}
          >
            <Download size={12} />
            {t('library.export')}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] disabled:opacity-60"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            title={t('library.importHint')}
          >
            <UploadIcon size={12} />
            {t('library.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importData(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className="focus-ring rounded-full px-2.5 py-1 text-[12px]"
            style={{
              background: tab === entry.key ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
              color: tab === entry.key ? 'var(--text)' : 'var(--text-mute)',
            }}
            aria-pressed={tab === entry.key}
          >
            {entry.label}
            <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--text-mute)' }}>
              {entry.count}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--text-mute)' }}>
        {t('library.storageNote')}
      </p>

      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
          <Loader2 size={14} className="animate-spin" />
          {t('common.loading')}
        </div>
      ) : null}

      {/* -------------------------------------------------------------- saved */}
      {tab === 'saved' ? (
        savedSounds.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {savedSounds.map((sound) => (
              <SoundCard key={sound.id} sound={sound} queue={savedSounds} />
            ))}
          </div>
        ) : (
          <Empty text={t('library.empty.saved')} action={{ to: '/explore', label: t('home.cta.explore') }} />
        )
      ) : null}

      {/* ------------------------------------------------------------- recent */}
      {tab === 'recent' ? (
        historySounds.length ? (
          <>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(t('library.clearConfirm'))) return;
                  await clearHistory();
                  await refreshHistory();
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
              >
                <Trash2 size={11} />
                {t('library.clearRecent')}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {history.map((row) => (
                <div key={row.id}>
                  <SoundCard sound={row.sound} queue={historySounds} compact />
                  <div className="mt-0.5 pl-12 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                    {relativeTime(row.playedAt, lang)}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty text={t('library.empty.recent')} action={{ to: '/explore', label: t('home.cta.explore') }} />
        )
      ) : null}

      {/* --------------------------------------------------------------- maps */}
      {tab === 'maps' ? (
        maps.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {maps.map((map) => (
              <div key={map.id} className="rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/maps/${map.id}`} className="text-[13.5px] font-medium hover:underline">
                      {map.title}
                    </Link>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-mute)' }}>
                      {t('maps.items', { n: map.itemIds.length })} 路 {relativeTime(map.updatedAt, lang)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(t('library.deleteConfirm', { name: map.title }))) return;
                      await deleteMap(map.id);
                      await refreshMaps();
                    }}
                    className="focus-ring rounded-full p-1.5"
                    style={{ color: 'var(--text-mute)' }}
                    aria-label={t('library.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {map.description ? (
                  <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    {map.description}
                  </p>
                ) : null}
                <p className="mt-2 text-[10.5px]" style={{ color: 'var(--text-mute)' }}>
                  {t('maps.private.Note')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty text={t('library.empty.maps')} action={{ to: '/explore', label: t('home.cta.explore') }} />
        )
      ) : null}

      {/* -------------------------------------------------------------- clips */}
      {tab === 'clips' ? (
        clips.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {clips.map((clip) => {
              const sound = clipToSound(clip);
              return (
                <div key={clip.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <SoundCard sound={sound} queue={clips.map(clipToSound)} compact />
                    <div className="mt-0.5 pl-12 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                      {clip.placeName || t('common.unknown')} 路 {formatDuration(clip.durationSec, lang)} 路{' '}
                      {clip.publicConsent ? t('upload.consent') : t('upload.private')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(t('library.deleteConfirm', { name: clip.title }))) return;
                      await deleteClip(clip.id);
                      await refreshClips();
                    }}
                    className="focus-ring mt-2 rounded-full p-1.5"
                    style={{ color: 'var(--text-mute)' }}
                    aria-label={t('library.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text={t('library.empty.clips')} action={{ to: '/upload', label: t('nav.upload') }} />
        )
      ) : null}

      {/* ----------------------------------------------------------- journeys */}
      {tab === 'journeys' ? (
        journeys.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {journeys.map((journey) => (
              <div key={journey.id} className="rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/journeys/${journey.id}`} className="text-[13.5px] font-medium hover:underline">
                      {journey.title}
                    </Link>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-mute)' }}>
                      {t('maps.items', { n: journey.itemIds.length })}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const sounds: Sound[] = [];
                        for (const id of journey.itemIds) {
                          const found = savedSounds.find((sound) => sound.id === id);
                          if (found) sounds.push(found);
                        }
                        if (sounds.length) await play(sounds[0]!, sounds);
                      }}
                      className="focus-ring rounded-full p-1.5"
                      style={{ color: 'var(--text-mute)' }}
                      aria-label={t('journeys.play')}
                    >
                      <Play size={12} />
                    </button>
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
                </div>
                <Link
                  to={`/journeys/${journey.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px]"
                  style={{ color: 'var(--accent)' }}
                >
                  <Waypoints size={11} />
                  {t('collections.open')}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <Empty text={t('library.empty.journeys')} action={{ to: '/explore', label: t('home.cta.explore') }} />
        )
      ) : null}
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: { to: string; label: string } }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <Pencil size={16} style={{ color: 'var(--text-mute)' }} />
      <p className="max-w-sm text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
        {text}
      </p>
      {action ? (
        <Link
          to={action.to}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}


