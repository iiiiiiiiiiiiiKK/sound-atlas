import { useEffect, useState } from 'react';
import { CATEGORY_COLOR, type Sound, type SoundCategory } from '@/types';
import { useT, useLang } from '@/stores/uiStore';
import { formatDuration } from '@/utils/format';

const LABEL_KEY: Record<SoundCategory, string> = {
  nature: 'category.nature',
  weather: 'category.weather',
  rain: 'category.rain',
  water: 'category.water',
  animal: 'category.animal',
  human: 'category.human',
  traffic: 'category.traffic',
  transport: 'category.transport',
  architecture: 'category.architecture',
  city: 'category.city',
};

export function useCategoryLabel(): (category: SoundCategory) => string {
  const t = useT();
  return (category) => t(LABEL_KEY[category] ?? 'category.nature');
}

export function CategoryDot({ category, size = 8 }: { category: SoundCategory; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: CATEGORY_COLOR[category],
        display: 'inline-block',
        flex: '0 0 auto',
      }}
    />
  );
}

export function CategoryChip({ category }: { category: SoundCategory }) {
  const label = useCategoryLabel()(category);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-5"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-dim)',
      }}
    >
      <CategoryDot category={category} size={6} />
      {label}
    </span>
  );
}

export function DurationChip({ seconds }: { seconds: number | null }) {
  const lang = useLang();
  return (
    <span className="font-mono text-[11px] tabular-nums text-mute">{formatDuration(seconds, lang)}</span>
  );
}

/** Renders the licence as a link that always keeps its attribution. */
export function LicenceLink({ sound }: { sound: Sound }) {
  return (
    <a
      href={sound.licence.url}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className="underline decoration-dotted underline-offset-2 hover:text-[var(--text)]"
    >
      {sound.licence.code.toUpperCase()}
    </a>
  );
}

/** Small helper that reveals a tooltip on hover/focus without a dependency. */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px]"
          style={{ background: 'var(--bg-raised)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

/** Copies text and reports success, with a fallback for browsers without the API. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  className,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
