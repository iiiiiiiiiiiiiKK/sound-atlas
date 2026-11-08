/**
 * Detail panel for one sound: playback, licence and attribution, and the actions that
 * put it into the user's own library. Used both as a right-hand drawer on Explore and
 * as a full page at /sound/:id.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  FolderPlus,
  Loader2,
  MapPin,
  Pause,
  Play,
  Share2,
  Waypoints,
} from 'lucide-react';
import { usePlayer } from '@/stores/playerStore';
import { useLang, useT, useUi } from '@/stores/uiStore';
import { CategoryChip, CopyButton, LicenceLink } from '@/components/atoms';
import { Waveform } from '@/components/Waveform';
import { audioEngine } from '@/services/audioEngine';
import { newId, formatDuration, formatDate } from '@/utils/format';
import { putMap, putJourney, removeSaved, saveSound } from '@/services/storage';
import type { Sound } from '@/types';

export function SoundDetail({ sound, queue, onClose }: { sound: Sound; queue?: Sound[]; onClose?: () => void }) {
  const t = useT();
  const lang = useLang();
  const notify = useUi((state) => state.notify);
  const refreshSaved = useUi((state) => state.refreshSaved);
  const refreshMaps = useUi((state) => state.refreshMaps);
  const refreshJourneys = useUi((state) => state.refreshJourneys);
  const savedIds = useUi((state) => state.saved);
  const maps = useUi((state) => state.maps);
  const journeys = useUi((state) => state.journeys);

  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const buffering = usePlayer((state) => state.buffering);
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);
  const canAnalyse = usePlayer((state) => state.canAnalyse);
  const play = usePlayer((state) => state.play);
  const toggle = usePlayer((state) => state.toggle);
  const seek = usePlayer((state) => state.seek);
  const setAmbient = usePlayer((state) => state.setAmbient);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showJourneyPicker, setShowJourneyPicker] = useState(false);

  const isCurrent = currentId === sound.id;
  const isSaved = useMemo(() => savedIds.some((row) => row.id === sound.id), [savedIds, sound.id]);
  const length = (isCurrent ? duration : 0) || sound.durationSec || 0;

  useEffect(() => {
    if (!isCurrent) {
      setAnalyser(null);
      return;
    }
    const timer = setTimeout(() => setAnalyser(audioEngine.analyserNode), 400);
    return () => clearTimeout(timer);
  }, [isCurrent, canAnalyse]);

  useEffect(() => {
    setShowMapPicker(false);
    setShowJourneyPicker(false);
  }, [sound.id]);

  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}#/sound/${encodeURIComponent(sound.id)}`;

  const toggleSaved = async () => {
    if (isSaved) {
      await removeSaved(sound.id);
      await refreshSaved();
      notify(t('sound.unsave'));
    } else {
      await saveSound(sound);
      await refreshSaved();
      notify(t('sound.saved'), 'success');
    }
  };

  const addToNewMap = async () => {
    const now = new Date().toISOString();
    const map = {
      id: newId('map'),
      title: sound.place?.name ? `${sound.place.name}` : sound.title.slice(0, 40),
      description: '',
      coverSoundId: sound.id,
      visibility: 'local' as const,
      itemIds: [sound.id],
      createdAt: now,
      updatedAt: now,
    };
    await putMap(map);
    await refreshMaps();
    notify(t('maps.addedTo', { name: map.title }), 'success');
    setShowMapPicker(false);
  };

  const addToMap = async (mapId: string) => {
    const map = maps.find((entry) => entry.id === mapId);
    if (!map) return;
    if (map.itemIds.includes(sound.id)) {
      notify(t('maps.addedTo', { name: map.title }));
      setShowMapPicker(false);
      return;
    }
    await putMap({ ...map, itemIds: [...map.itemIds, sound.id], updatedAt: new Date().toISOString() });
    await refreshMaps();
    notify(t('maps.addedTo', { name: map.title }), 'success');
    setShowMapPicker(false);
  };

  const addToNewJourney = async () => {
    const now = new Date().toISOString();
    const journey = {
      id: newId('journey'),
      title: sound.place?.name ? `${sound.place.name}` : sound.title.slice(0, 40),
      description: '',
      itemIds: [sound.id],
      createdAt: now,
      updatedAt: now,
    };
    await putJourney(journey);
    await refreshJourneys();
    notify(t('maps.addedTo', { name: journey.title }), 'success');
    setShowJourneyPicker(false);
  };

  const addToJourney = async (journeyId: string) => {
    const journey = journeys.find((entry) => entry.id === journeyId);
    if (!journey) return;
    if (journey.itemIds.includes(sound.id)) {
      notify(t('maps.addedTo', { name: journey.title }));
      setShowJourneyPicker(false);
      return;
    }
    await putJourney({ ...journey, itemIds: [...journey.itemIds, sound.id], updatedAt: new Date().toISOString() });
    await refreshJourneys();
    notify(t('maps.addedTo', { name: journey.title }), 'success');
    setShowJourneyPicker(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin">
      <div className="relative px-4 pb-4 pt-4 sm:px-5">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="focus-ring absolute right-3 top-3 rounded-full border px-2 py-1 text-[11px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
          >
            {t('sound.close')}
          </button>
        ) : null}

        <h2 className="pr-16 text-[17px] font-semibold leading-snug">{sound.title}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-mute)' }}>
          {sound.place ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} />
              {sound.place.name}
              {sound.place.country ? `, ${sound.place.country}` : ''}
            </span>
          ) : null}
          <CategoryChip category={sound.soundCategory} />
          <span className="font-mono tabular-nums">{formatDuration(sound.durationSec, lang)}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isCurrent ? void toggle() : void play(sound, queue))}
            className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {isCurrent && buffering && !playing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isCurrent && playing ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}
            {isCurrent && playing ? t('sound.pause') : t('sound.play')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isCurrent) void play(sound, queue);
              setAmbient(true);
            }}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            {t('sound.ambient')}
          </button>
          <button
            type="button"
            onClick={() => void toggleSaved()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
            style={{
              borderColor: isSaved ? 'color-mix(in srgb, var(--accent) 50%, var(--border))' : 'var(--border)',
              color: isSaved ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
            {isSaved ? t('sound.saved') : t('sound.save')}
          </button>
        </div>

        <div className="mt-4">
          {isCurrent ? (
            <Waveform analyser={analyser} playing={playing} duration={length} currentTime={currentTime} onSeek={seek} seed={sound.id} height={62} bars={80} />
          ) : (
            <Waveform analyser={null} playing={false} duration={sound.durationSec ?? 0} currentTime={0} seed={sound.id} height={62} bars={80} />
          )}
          {isCurrent && !canAnalyse ? (
            <p className="mt-1 text-[10.5px]" style={{ color: 'var(--text-mute)' }}>
              {t('sound.noCors')}
            </p>
          ) : null}
        </div>

        {sound.description ? (
          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {sound.description}
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
          <dt style={{ color: 'var(--text-mute)' }}>{t('sound.author')}</dt>
          <dd className="min-w-0 truncate">{sound.author}</dd>
          <dt style={{ color: 'var(--text-mute)' }}>{t('sound.licence')}</dt>
          <dd>
            <LicenceLink sound={sound} />
          </dd>
          <dt style={{ color: 'var(--text-mute)' }}>{t('sound.source')}</dt>
          <dd className="min-w-0 truncate">
            {sound.source === 'commons' ? 'Wikimedia Commons' : sound.source === 'inaturalist' ? 'iNaturalist' : 'Local'}
          </dd>
          <dt style={{ color: 'var(--text-mute)' }}>{t('sound.place')}</dt>
          <dd>
            {sound.place
              ? `${sound.place.name}${sound.place.country ? `, ${sound.place.country}` : ''} · ${
                  sound.place.precision === 'exact'
                    ? t('sound.precisionExact')
                    : sound.place.precision === 'city'
                      ? t('sound.precisionCity')
                      : t('sound.precisionUser')
                }`
              : t('common.unknown')}
          </dd>
          {sound.recordedAt ? (
            <>
              <dt style={{ color: 'var(--text-mute)' }}>{t('upload.recordedAt')}</dt>
              <dd>{formatDate(sound.recordedAt, lang)}</dd>
            </>
          ) : null}
        </dl>

        <p className="mt-4 rounded-lg border p-2.5 text-[11px] leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}>
          {sound.attribution}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMapPicker((value) => !value)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <FolderPlus size={12} />
            {t('sound.addToMap')}
          </button>
          <button
            type="button"
            onClick={() => setShowJourneyPicker((value) => !value)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <Waypoints size={12} />
            {t('sound.addToJourney')}
          </button>
          <CopyButton
            value={shareUrl}
            label={t('sound.copy')}
            copiedLabel={t('sound.copied')}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px]"
          />
          <a
            href={sound.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <ExternalLink size={12} />
            {t('sound.openOriginal')}
          </a>
        </div>

        {showMapPicker ? (
          <div className="mt-2 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-1 text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {t('maps.pick')}
            </div>
            <div className="flex flex-col gap-1">
              {maps.map((map) => (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => void addToMap(map.id)}
                  className="rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--bg-panel)]"
                >
                  {map.title}
                  <span className="ml-1 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                    {t('maps.items', { n: map.itemIds.length })}
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => void addToNewMap()} className="rounded px-2 py-1 text-left text-[12px]" style={{ color: 'var(--accent)' }}>
                + {t('maps.new')}
              </button>
            </div>
          </div>
        ) : null}

        {showJourneyPicker ? (
          <div className="mt-2 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-1">
              {journeys.map((journey) => (
                <button
                  key={journey.id}
                  type="button"
                  onClick={() => void addToJourney(journey.id)}
                  className="rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--bg-panel)]"
                >
                  {journey.title}
                  <span className="ml-1 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                    {t('maps.items', { n: journey.itemIds.length })}
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => void addToNewJourney()} className="rounded px-2 py-1 text-left text-[12px]" style={{ color: 'var(--accent)' }}>
                + {t('journeys.new')}
              </button>
            </div>
          </div>
        ) : null}

        <Link
          to="/about"
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] underline decoration-dotted underline-offset-2"
          style={{ color: 'var(--text-mute)' }}
        >
          <Share2 size={11} />
          {t('about.sources')}
        </Link>
      </div>
    </div>
  );
}
