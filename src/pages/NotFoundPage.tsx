import { Link } from 'react-router-dom';
import { useT } from '@/stores/uiStore';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-start gap-3 px-3 py-16 sm:px-5">
      <p className="font-mono text-[11px]" style={{ color: 'var(--text-mute)' }}>
        404
      </p>
      <h1 className="text-[22px] font-semibold tracking-tight">{t('error.notFound')}</h1>
      <Link
        to="/"
        className="focus-ring rounded-full px-3.5 py-2 text-[12.5px]"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {t('error.backHome')}
      </Link>
    </div>
  );
}
