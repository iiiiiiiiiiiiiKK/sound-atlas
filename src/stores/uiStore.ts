/**
 * UI store — language, theme, and the local-library mirror used across pages.
 *
 * Library data is read from IndexedDB and cached here so every page can render
 * immediately, and any write refreshes the cache in one place.
 */
import { create } from 'zustand';
import { detectLang, makeTranslator, type Translate } from '@/locales';
import * as storage from '@/services/storage';
import type { ClipRow } from '@/services/storage';
import type { HistoryEntry, Lang, LocalJourney, LocalSoundMap, SoundSnapshot, Theme } from '@/types';

const LANG_KEY = 'sound-atlas:lang';
const THEME_KEY = 'sound-atlas:theme';

function readLang(): Lang {
  if (typeof localStorage === 'undefined') return detectLang();
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  return detectLang();
}

function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'dark';
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface UiState {
  lang: Lang;
  theme: Theme;
  toasts: Toast[];
  storageReady: boolean;
  storageError: string | null;

  saved: SoundSnapshot[];
  maps: LocalSoundMap[];
  journeys: LocalJourney[];
  clips: ClipRow[];
  history: HistoryEntry[];

  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  hydrate: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  refreshMaps: () => Promise<void>;
  refreshJourneys: () => Promise<void>;
  refreshClips: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

let toastId = 0;

export const useUi = create<UiState>((set, get) => ({
  lang: readLang(),
  theme: readTheme(),
  toasts: [],
  storageReady: false,
  storageError: null,

  saved: [],
  maps: [],
  journeys: [],
  clips: [],
  history: [],

  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage may be blocked; the choice still applies for this session */
    }
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    set({ lang });
  },

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore blocked storage */
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  notify: (message, tone = 'info') => {
    toastId += 1;
    const toast: Toast = { id: toastId, message, tone };
    set({ toasts: [...get().toasts, toast] });
    setTimeout(() => get().dismissToast(toast.id), 3600);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),

  hydrate: async () => {
    const available = await storage.isStorageAvailable();
    if (!available) {
      set({
        storageReady: false,
        storageError: 'indexeddb-unavailable',
      });
      return;
    }
    try {
      const [saved, maps, journeys, clips, history] = await Promise.all([
        storage.listSaved(),
        storage.listMaps(),
        storage.listJourneys(),
        storage.listClips(),
        storage.listHistory(),
      ]);
      set({ storageReady: true, storageError: null, saved, maps, journeys, clips, history });
    } catch (error) {
      set({ storageReady: false, storageError: error instanceof Error ? error.message : 'unknown' });
    }
  },

  refreshSaved: async () => set({ saved: await storage.listSaved() }),
  refreshMaps: async () => set({ maps: await storage.listMaps() }),
  refreshJourneys: async () => set({ journeys: await storage.listJourneys() }),
  refreshClips: async () => set({ clips: await storage.listClips() }),
  refreshHistory: async () => set({ history: await storage.listHistory() }),
}));

/** Translator hook — re-renders whenever the language changes. */
export function useT(): Translate {
  const lang = useUi((state) => state.lang);
  return makeTranslator(lang);
}

export function useLang(): Lang {
  return useUi((state) => state.lang);
}
