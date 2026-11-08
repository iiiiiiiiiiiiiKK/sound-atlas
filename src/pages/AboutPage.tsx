/** About 鈥?sources, licences, privacy and the honest list of limitations. */
import { useEffect, useState } from 'react';
import { Code2, ExternalLink } from 'lucide-react';
import { useT } from '@/stores/uiStore';
import { catalogueMeta, type CommonsCatalogueMeta } from '@/services/sources/commons';
import { XGlyph } from '@/components/Layout';

export function AboutPage() {
  const t = useT();
  const [meta, setMeta] = useState<CommonsCatalogueMeta | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    catalogueMeta()
      .then(setMeta)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="mx-auto max-w-[820px] px-3 py-6 sm:px-5">
      <h1 className="text-[24px] font-semibold tracking-tight">{t('about.title')}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {t('about.lead')}
      </p>

      <section className="mt-7">
        <h2 className="text-[16px] font-semibold">{t('about.sources')}</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          <SourceCard
            title={t('about.source.commons')}
            body={t('about.source.commonsBody')}
            tags={['CC0', 'Public domain', 'CC BY', 'CC BY-SA']}
            href="https://commons.wikimedia.org/wiki/Category:Soundscape"
          />
          <SourceCard
            title={t('about.source.inat')}
            body={t('about.source.inatBody')}
            tags={['CC0', 'CC BY', 'CC BY-SA']}
            href="https://www.inaturalist.org/observations? sounds=true"
          />
          <SourceCard title={t('about.source.local')} body={t('about.source.localBody')} tags={['IndexedDB']} />
        </div>
        {meta ? (
          <p className="mt-2 font-mono text-[10.5px]" style={{ color: 'var(--text-mute)' }}>
            Commons catalogue: {meta.count} records 路 built {new Date(meta.generatedAt).toISOString().slice(0, 10)}
          </p>
        ) : failed ? (
          <p className="mt-2 text-[10.5px]" style={{ color: 'var(--warm)' }}>
            {t('explore.error')}
          </p>
        ) : null}
      </section>

      <section className="mt-7">
        <h2 className="text-[16px] font-semibold">{t('about.privacy')}</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {t('about.privacyBody')}
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-[16px] font-semibold">{t('about.limits')}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          <li>{t('about.limits.1')}</li>
          <li>{t('about.limits.2')}</li>
          <li>{t('about.limits.3')}</li>
          <li>{t('about.limits.4')}</li>
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="text-[16px] font-semibold">{t('about.tech')}</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {t('about.techBody')}
        </p>
      </section>

      <section className="mt-7 flex flex-wrap items-center gap-2">
        <a
          href="https://x.com/0xkillcoin"
          target="_blank"
          rel="noreferrer noopener"
          className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <XGlyph size={12} />
          {t('about.author')}
        </a>
        <a
          href="https://github.com/iiiiiiiiiiiiiKK/sound-atlas"
          target="_blank"
          rel="noreferrer noopener"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          <Code2 size={12} />
          GitHub
        </a>
      </section>

      <p className="mt-6 text-[11px]" style={{ color: 'var(--text-mute)' }}>
        {t('about.mapData')}
      </p>
    </div>
  );
}

function SourceCard({ title, body, tags, href }: { title: string; body: string; tags: string[]; href?: string }) {
  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13.5px] font-medium">{title}</h3>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="focus-ring flex-none rounded p-1" aria-label={title}>
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--text-mute)' }}>
        {body}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border px-1.5 py-0.5 font-mono text-[10px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

