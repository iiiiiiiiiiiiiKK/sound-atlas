/**
 * Shared page chrome: the header (with the author's X link), the persistent player
 * bar, the ambient overlay host and toasts.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  AudioLines,
  Bookmark,
  Code2,
  Compass,
  Info,
  Languages,
  Menu,
  Moon,
  Shuffle,
  Sun,
  Upload,
  Waypoints,
  X as CloseIcon,
} from 'lucide-react';
import { useLang, useT, useUi } from '@/stores/uiStore';
import { usePlayer } from '@/stores/playerStore';
import { PlayerBar } from '@/components/PlayerBar';
import { AmbientOverlay } from '@/components/AmbientOverlay';

const AUTHOR_URL = 'https://x.com/0xkillcoin';

export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[7px]"
      style={{
        width: size + 10,
        height: size + 10,
        background: 'linear-gradient(150deg, var(--accent), #1b6f8a)',
        color: 'var(--accent-ink)',
      }}
      aria-hidden
    >
      <AudioLines size={size} strokeWidth={2.4} />
    </span>
  );
}

/** The author's X mark, drawn inline so no external icon font is needed. */
export function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AuthorLink({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <a
      href={AUTHOR_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-colors hover:text-[var(--text)]"
      style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      title={t('nav.author')}
      aria-label={t('nav.author')}
    >
      <XGlyph size={13} />
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>@0xkillcoin</span>
    </a>
  );
}

function LanguageToggle() {
  const lang = useLang();
  const setLang = useUi((state) => state.setLang);
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-colors hover:text-[var(--text)]"
      style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      title={t('nav.language')}
      aria-label={t('nav.language')}
    >
      <Languages size={13} />
      {lang === 'en' ? 'EN' : '中文'}
    </button>
  );
}

function ThemeToggle() {
  const theme = useUi((state) => state.theme);
  const toggleTheme = useUi((state) => state.toggleTheme);
  const t = useT();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="focus-ring inline-flex items-center justify-center rounded-full border p-2 transition-colors hover:text-[var(--text)]"
      style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      title={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
      aria-label={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
    >
      {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );
}

const NAV = [
  { to: '/explore', key: 'nav.explore', icon: Compass },
  { to: '/collections', key: 'nav.collections', icon: Bookmark },
  { to: '/journeys', key: 'nav.journeys', icon: Waypoints },
  { to: '/upload', key: 'nav.upload', icon: Upload },
  { to: '/library', key: 'nav.library', icon: AudioLines },
  { to: '/about', key: 'nav.about', icon: Info },
];

function Header() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:px-5">
        <Link to="/" className="focus-ring flex items-center gap-2 rounded-md" aria-label={t('brand.name')}>
          <BrandMark />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">{t('brand.name')}</span>
        </Link>

        <nav className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex" aria-label={t('nav.menu')}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `focus-ring rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                  isActive ? 'text-[var(--text)]' : 'text-mute hover:text-[var(--text-dim)]'
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: 'color-mix(in srgb, var(--accent) 14%, transparent)' } : undefined
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            to="/random"
            className="focus-ring hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-colors hover:text-[var(--text)] sm:inline-flex"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <Shuffle size={13} />
            <span className="hidden md:inline">{t('nav.random')}</span>
          </Link>
          <AuthorLink compact />
          <LanguageToggle />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="focus-ring inline-flex items-center justify-center rounded-full border p-2 lg:hidden"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            aria-expanded={open}
            aria-label={open ? t('nav.close') : t('nav.menu')}
          >
            {open ? <CloseIcon size={14} /> : <Menu size={14} />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className="border-t px-3 pb-3 pt-2 lg:hidden"
          style={{ borderColor: 'var(--border)' }}
          aria-label={t('nav.menu')}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `focus-ring flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                      isActive ? 'text-[var(--text)]' : 'text-dim'
                    }`
                  }
                  style={({ isActive }) => ({
                    borderColor: 'var(--border)',
                    background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  })}
                >
                  <Icon size={15} />
                  {t(item.key)}
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function Toasts() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[1200] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className="pointer-events-auto rounded-xl border px-3.5 py-2.5 text-left text-[13px] shadow-lg"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--bg-raised)',
            color: toast.tone === 'error' ? '#f87171' : 'var(--text)',
          }}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="mt-16 border-t px-3 py-8 text-[12px] sm:px-5" style={{ borderColor: 'var(--border)', color: 'var(--text-mute)' }}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {t('brand.name')} · {t('brand.tagline')}
          </span>
          <span className="hidden sm:inline">·</span>
          <span>{t('about.mapData')}</span>
        </div>
        <div className="flex items-center gap-3">
          <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 hover:text-[var(--text-dim)]">
            <XGlyph size={12} /> @0xkillcoin
          </a>
          <a
            href="https://github.com/iiiiiiiiiiiiiKK/sound-atlas"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 hover:text-[var(--text-dim)]"
          >
            <Code2 size={12} /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const currentId = usePlayer((state) => state.queue[state.index]?.sound.id ?? null);
  return (
    <div className="flex min-h-full flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      <main className={`flex-1 ${currentId ? 'pb-32 sm:pb-24' : ''}`}>{children}</main>
      <Footer />
      <PlayerBar />
      <AmbientOverlay />
      <Toasts />
    </div>
  );
}

