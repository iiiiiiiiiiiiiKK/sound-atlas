/**
 * Upload — a file picker plus an in-browser recorder.
 *
 * Both paths end in the same review form, and nothing is saved until the user confirms
 * they own the recording. Audio never leaves the browser: the Blob is written to
 * IndexedDB, and the page says so plainly.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useT, useUi } from '@/stores/uiStore';
import { putClip } from '@/services/storage';
import { newId, formatBytes, formatDuration } from '@/utils/format';
import { SOUND_CATEGORIES, type SoundCategory } from '@/types';
import { useCategoryLabel } from '@/components/atoms';
import { Waveform } from '@/components/Waveform';

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];

interface Draft {
  blob: Blob;
  mime: string;
  name: string;
  durationSec: number | null;
  url: string;
}

export function UploadPage() {
  const t = useT();
  const categoryLabel = useCategoryLabel();
  const navigate = useNavigate();
  const notify = useUi((state) => state.notify);
  const refreshClips = useUi((state) => state.refreshClips);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [country, setCountry] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [sharePrecise, setSharePrecise] = useState(false);
  const [category, setCategory] = useState<SoundCategory>('nature');
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10));
  const [rights, setRights] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Release any object URL when the draft is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (draft) URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const acceptBlob = async (blob: Blob, name: string) => {
    if (blob.size > MAX_BYTES) {
      notify(t('upload.tooLarge', { size: formatBytes(MAX_BYTES) }), 'error');
      return;
    }
    const mime = blob.type || 'audio/mpeg';
    const url = URL.createObjectURL(blob);
    // Read the real duration from the file instead of guessing it.
    const durationSec = await readDuration(url).catch(() => null);
    setDraft((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return { blob, mime, name, durationSec, url };
    });
    if (!title) setTitle(name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80));
  };

  const onFile = async (file: File) => {
    const mime = file.type || '';
    const nameOk = ACCEPTED.includes(mime) || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name);
    if (!nameOk) {
      notify(t('upload.badType'), 'error');
      return;
    }
    try {
      await acceptBlob(file, file.name);
    } catch {
      notify(t('upload.readFailed'), 'error');
    }
  };

  const startRecording = async () => {
    setRecordError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setRecordError(t('upload.unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size < 600) {
          setRecordError(t('upload.recordFailed'));
          return;
        }
        await acceptBlob(blob, `recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`);
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setRecordError(name === 'NotAllowedError' ? t('upload.permissionDenied') : t('upload.recordFailed'));
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const discard = () => {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const save = async () => {
    if (!draft) {
      notify(t('upload.needFile'), 'error');
      return;
    }
    if (!title.trim()) {
      notify(t('upload.needTitle'), 'error');
      return;
    }
    if (!rights) {
      notify(t('upload.rightsRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await putClip({
        id: newId('clip'),
        title: title.trim().slice(0, 140),
        description: description.trim().slice(0, 1200),
        placeName: placeName.trim(),
        country: country.trim(),
        lat: sharePrecise && lat ? Number(lat) : null,
        lon: sharePrecise && lon ? Number(lon) : null,
        sharePreciseLocation: sharePrecise,
        soundCategory: category,
        recordedAt: recordedAt ? new Date(recordedAt).toISOString() : null,
        createdAt: new Date().toISOString(),
        durationSec: draft.durationSec,
        mime: draft.mime,
        blob: draft.blob,
        publicConsent: !isPrivate,
        rightsConfirmed: rights,
      });
      await refreshClips();
      notify(t('upload.saved'), 'success');
      navigate('/library');
    } catch {
      notify(t('upload.readFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] px-3 py-5 sm:px-5">
      <h1 className="text-[21px] font-semibold tracking-tight">{t('upload.title')}</h1>
      <p className="mt-1 max-w-2xl text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
        {t('upload.subtitle')}
      </p>
      <p
        className="mt-3 rounded-lg border p-2.5 text-[11.5px] leading-relaxed"
        style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
      >
        {t('upload.localOnly')}
      </p>

      {/* ------------------------------------------------------- source pick */}
      {!draft ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="focus-ring flex flex-col items-start gap-2 rounded-xl border p-4 text-left hover:border-[var(--border-strong)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
          >
            <UploadIcon size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-[13.5px] font-medium">{t('upload.file')}</span>
            <span className="text-[11.5px]" style={{ color: 'var(--text-mute)' }}>
              {t('upload.fileHint', { size: formatBytes(MAX_BYTES) })}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => void (recording ? stopRecording() : startRecording())}
            className="focus-ring flex flex-col items-start gap-2 rounded-xl border p-4 text-left hover:border-[var(--border-strong)]"
            style={{
              borderColor: recording ? 'var(--accent)' : 'var(--border)',
              background: recording ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-raised))' : 'var(--bg-raised)',
            }}
          >
            {recording ? <Square size={18} style={{ color: 'var(--accent)' }} /> : <Mic size={18} style={{ color: 'var(--accent)' }} />}
            <span className="text-[13.5px] font-medium">{recording ? t('upload.recording') : t('upload.record')}</span>
            <span className="text-[11.5px]" style={{ color: 'var(--text-mute)' }}>
              {recording ? t('upload.stopRecord') : t('upload.startRecord')}
            </span>
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[12.5px]">{draft.name}</span>
            <button
              type="button"
              onClick={discard}
              className="focus-ring inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
            >
              <Trash2 size={11} />
              {t('upload.discard')}
            </button>
          </div>
          <div className="mt-2">
            <Waveform analyser={null} playing={false} duration={draft.durationSec ?? 0} currentTime={0} seed={draft.name} height={56} bars={80} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10.5px]" style={{ color: 'var(--text-mute)' }}>
            <span>{formatBytes(draft.blob.size)}</span>
            <span>{formatDuration(draft.durationSec, 'en')}</span>
          </div>
          <audio controls src={draft.url} className="mt-2 w-full" />
        </div>
      )}

      {recordError ? (
        <p className="mt-2 text-[11.5px]" style={{ color: 'var(--warm)' }}>
          {recordError}
        </p>
      ) : null}

      {/* -------------------------------------------------------------- form */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('upload.titleField')} · {t('common.required')}
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('upload.description')} · {t('common.optional')}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={1200}
            className="focus-ring mt-1 w-full resize-y rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
        </label>

        <label>
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('upload.place')} · {t('common.optional')}
          </span>
          <input
            value={placeName}
            onChange={(event) => setPlaceName(event.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
        </label>
        <label>
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('home.stat.countries')} · {t('common.optional')}
          </span>
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
        </label>

        <label>
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('upload.category')}
          </span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SoundCategory)}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          >
            {SOUND_CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {categoryLabel(entry)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-mute)' }}>
            {t('upload.recordedAt')}
          </span>
          <input
            type="date"
            value={recordedAt}
            onChange={(event) => setRecordedAt(event.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)' }}
          />
        </label>
      </div>

      {/* -------------------------------------------------------- privacy */}
      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
        <label className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <input
            type="checkbox"
            checked={sharePrecise}
            onChange={(event) => setSharePrecise(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <span>
            {t('upload.precise')}
            <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {t('upload.preciseHint')}
            </span>
          </span>
        </label>

        {sharePrecise ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              inputMode="decimal"
              placeholder={t('upload.lat')}
              aria-label={t('upload.lat')}
              className="focus-ring rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <input
              value={lon}
              onChange={(event) => setLon(event.target.value)}
              inputMode="decimal"
              placeholder={t('upload.lon')}
              aria-label={t('upload.lon')}
              className="focus-ring rounded-lg border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
        ) : null}

        <label className="mt-3 flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <span>
            {t('upload.private')}
            <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {t('upload.privateHint')}
            </span>
          </span>
        </label>

        <label className="mt-3 flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <span>{t('upload.rights')}</span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !draft}
          className="focus-ring rounded-full px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {t('upload.save')}
        </button>
      </div>
    </div>
  );
}

/** Read a blob URL's real duration through a detached media element. */
function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement('audio');
    const cleanup = () => {
      element.removeAttribute('src');
      element.load();
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) ? Math.round(element.duration) : 0;
      cleanup();
      if (duration > 0) resolve(duration);
      else reject(new Error('unknown duration'));
    };
    element.onerror = () => {
      cleanup();
      reject(new Error('decode failed'));
    };
    element.src = url;
  });
}
