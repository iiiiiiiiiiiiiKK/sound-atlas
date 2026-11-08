import { describe, expect, it } from 'vitest';
import { audioEngine } from '@/services/audioEngine';

describe('AudioEngine', () => {
  it('exposes no analyser before anything is loaded', () => {
    expect(audioEngine.isAnalysing).toBe(false);
    expect(audioEngine.analyserNode).toBeNull();
  });

  it('stops without throwing when nothing is loaded', () => {
    expect(() => audioEngine.stop()).not.toThrow();
    expect(() => audioEngine.pause()).not.toThrow();
    expect(() => audioEngine.seek(10)).not.toThrow();
    expect(() => audioEngine.setVolume(0.4)).not.toThrow();
    expect(() => audioEngine.setMuted(true)).not.toThrow();
    expect(() => audioEngine.setLoop(true)).not.toThrow();
    expect(() => audioEngine.setRate(1.5)).not.toThrow();
  });

  it('loads a source and reports the resolved duration', async () => {
    let loaded: { duration: number; canAnalyse: boolean } | null = null;
    audioEngine.setListeners({
      onLoaded: (duration, canAnalyse) => {
        loaded = { duration, canAnalyse };
      },
    });
    // jsdom has no real audio; the stub reports a 12s duration on assignment.
    await audioEngine.load('https://example.test/a.mp3', 'audio/mpeg', false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loaded).not.toBeNull();
    expect(loaded!.duration).toBeGreaterThan(0);
    audioEngine.dispose();
  });
});
