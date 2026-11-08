/**
 * Player store — owns the queue and mirrors the audio engine into React.
 *
 * Everything UI-facing about playback lives here: current sound, position, duration,
 * buffering, volume, speed, loop, whether a real spectrum is available, and the
 * ambient-mode extras (auto-advance and sleep timer).
 */
import { create } from 'zustand';
import { audioEngine } from '@/services/audioEngine';
import { pushHistory } from '@/services/storage';
import type { Sound } from '@/types';

export interface QueueItem {
  sound: Sound;
}

interface PlayerState {
  queue: QueueItem[];
  index: number;
  /** Id of the sound currently loaded into the element, or null after a stop. */
  loadedId: string | null;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  canAnalyse: boolean;
  error: string | null;
  volume: number;
  muted: boolean;
  loop: boolean;
  rate: number;
  ambient: boolean;
  autoAdvance: boolean;
  sleepTimerMinutes: number | null;
  sleepDeadline: number | null;

  play: (sound: Sound, queue?: Sound[]) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  setRate: (value: number) => void;
  stop: () => void;
  retry: () => void;
  setAmbient: (value: boolean) => void;
  setAutoAdvance: (value: boolean) => void;
  setSleepTimer: (minutes: number | null) => void;
  clearQueue: () => void;
}

const RATES = [0.75, 1, 1.25, 1.5];

let sleepTimeout: ReturnType<typeof setTimeout> | null = null;

export const usePlayer = create<PlayerState>((set, get) => {
  const advance = () => {
    const { index, queue, ambient, autoAdvance } = get();
    const shouldAdvance = ambient ? autoAdvance : autoAdvance;
    if (!shouldAdvance) {
      set({ playing: false });
      return;
    }
    if (index + 1 < queue.length) {
      const nextItem = queue[index + 1];
      set({ index: index + 1 });
      void loadAndPlay(nextItem.sound);
    } else {
      set({ playing: false });
    }
  };

  const loadAndPlay = async (sound: Sound) => {
    set({
      error: null,
      buffering: true,
      currentTime: 0,
      duration: sound.durationSec ?? 0,
      canAnalyse: false,
      loadedId: sound.id,
    });
    audioEngine.setLoop(get().loop);
    audioEngine.setRate(get().rate);
    audioEngine.setVolume(get().volume);
    audioEngine.setMuted(get().muted);
    await audioEngine.load(sound.audioUrl, sound.mime, sound.canAnalyse);
    await audioEngine.play();
    void pushHistory(sound).catch(() => undefined);
  };

  audioEngine.setListeners({
    onTimeUpdate: (currentTime, duration) => set({ currentTime, duration: duration || get().duration }),
    onPlayStateChange: (playing) => set({ playing }),
    onBuffering: (buffering) => set({ buffering }),
    onLoaded: (duration, canAnalyse) => set({ duration: duration || get().duration, canAnalyse }),
    onError: (message) =>
      set({
        error: message,
        playing: false,
        buffering: false,
      }),
    onEnded: () => advance(),
  });

  return {
    queue: [],
    index: 0,
    loadedId: null,
    playing: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    canAnalyse: false,
    error: null,
    volume: 0.9,
    muted: false,
    loop: false,
    rate: 1,
    ambient: false,
    autoAdvance: false,
    sleepTimerMinutes: null,
    sleepDeadline: null,

    play: async (sound, queue) => {
      const list: Sound[] = queue?.length ? queue : [sound];
      const startIndex = Math.max(
        0,
        list.findIndex((entry) => entry.id === sound.id),
      );
      set({ queue: list.map((entry) => ({ sound: entry })), index: startIndex });
      await loadAndPlay(sound);
    },

    toggle: async () => {
      const { queue, index, playing, loadedId, currentTime, duration } = get();
      const current = queue[index]?.sound;
      if (!current) return;
      if (playing) {
        audioEngine.pause();
        return;
      }
      // Nothing loaded yet (e.g. after a stop) — reload from the queue.
      if (loadedId !== current.id || (currentTime === 0 && duration === 0)) {
        await loadAndPlay(current);
        return;
      }
      await audioEngine.toggle();
    },

    next: () => {
      const { queue, index } = get();
      const nextItem = queue[index + 1];
      if (!nextItem) return;
      set({ index: index + 1 });
      void loadAndPlay(nextItem.sound);
    },

    previous: () => {
      const { queue, index, currentTime } = get();
      // Restart the current clip first, like every other player.
      if (currentTime > 3) {
        audioEngine.seek(0);
        return;
      }
      const previousItem = queue[index - 1];
      if (!previousItem) {
        audioEngine.seek(0);
        return;
      }
      set({ index: index - 1 });
      void loadAndPlay(previousItem.sound);
    },

    seek: (seconds) => {
      audioEngine.seek(seconds);
      set({ currentTime: seconds });
    },

    setVolume: (value) => {
      audioEngine.setVolume(value);
      set({ volume: value, muted: value === 0 });
    },

    toggleMute: () => {
      const next = !get().muted;
      audioEngine.setMuted(next);
      set({ muted: next });
    },

    toggleLoop: () => {
      const next = !get().loop;
      audioEngine.setLoop(next);
      set({ loop: next });
    },

    setRate: (value) => {
      audioEngine.setRate(value);
      set({ rate: value });
    },

    stop: () => {
      audioEngine.stop();
      set({ playing: false, currentTime: 0, duration: 0, canAnalyse: false, error: null, loadedId: null });
    },

    retry: () => {
      const { queue, index } = get();
      const current = queue[index]?.sound;
      if (!current) return;
      void loadAndPlay(current);
    },

    setAmbient: (value) => set({ ambient: value }),

    setAutoAdvance: (value) => set({ autoAdvance: value }),

    setSleepTimer: (minutes) => {
      if (sleepTimeout) clearTimeout(sleepTimeout);
      sleepTimeout = null;
      if (minutes == null) {
        set({ sleepTimerMinutes: null, sleepDeadline: null });
        return;
      }
      sleepTimeout = setTimeout(() => {
        audioEngine.pause();
        set({ sleepTimerMinutes: null, sleepDeadline: null });
      }, minutes * 60_000);
      set({ sleepTimerMinutes: minutes, sleepDeadline: Date.now() + minutes * 60_000 });
    },

    clearQueue: () => {
      audioEngine.stop();
      set({ queue: [], index: 0, playing: false, currentTime: 0, duration: 0 });
    },
  };
});

export function cycleRate(current: number): number {
  const position = RATES.indexOf(current);
  return RATES[(position + 1) % RATES.length] ?? 1;
}

export function currentSound(state: PlayerState): Sound | null {
  return state.queue[state.index]?.sound ?? null;
}
