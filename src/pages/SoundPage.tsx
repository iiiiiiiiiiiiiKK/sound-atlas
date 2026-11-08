/** Full-page view for one sound, reached by a deep link such as /sound/:id. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getSoundById } from '@/services/soundService';
import { SoundDetail } from '@/components/SoundDetail';
import { useT } from '@/stores/uiStore';

export function SoundPage() {
  const { id = '' } = useParams();
  const t = useT();
  const [sound, setSound] = useState<Awaited<ReturnType<typeof getSoundById>>>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      const found = await getSoundById(decodeURIComponent(id));
      if (cancelled) return;
      setSound(found);
      setState(found ? 'ready' : 'missing');
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-[820px] px-3 py-5 sm:px-5">
      <Link to="/explore" className="focus-ring inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-mute)' }}>
        <ArrowLeft size={13} />
        {t('error.backHome')}
      </Link>

      {state === 'loading' ? (
        <div className="mt-10 flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-mute)' }}>
          <Loader2 size={14} className="animate-spin" />
          {t('common.loading')}
        </div>
      ) : state === 'missing' || !sound ? (
        <div className="mt-10 flex flex-col gap-2">
          <h1 className="text-[18px] font-semibold">{t('error.notFound')}</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--text-mute)' }}>
            {t('explore.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
          <SoundDetail sound={sound} queue={[sound]} />
        </div>
      )}
    </div>
  );
}
