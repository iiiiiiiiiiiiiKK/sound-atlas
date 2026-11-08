/**
 * Single-owner audio engine.
 *
 * Only one clip can ever play: every load disposes the previous element, so pressing
 * play on a second sound can never leave two recordings running at once.
 *
 * Spectrum analysis is opt-in per file. Before playback we probe the audio host with a
 * one-byte CORS fetch:
 *   - allowed  → the element is loaded with crossOrigin="anonymous" and routed through
 *                an AnalyserNode, so the drawn spectrum is computed from real samples;
 *   - refused  → the element is loaded plainly and no analyser is created. (Routing a
 *                tainted element through Web Audio would silence it, which is exactly
 *                the failure mode we must avoid.) The UI then shows a static waveform.
 */
export interface EngineEvents {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onLoaded?: (duration: number, canAnalyse: boolean) => void;
  onBuffering?: (buffering: boolean) => void;
}

const PROBE_TIMEOUT = 5000;

export class AudioEngine {
  private element: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private listeners: EngineEvents = {};
  private pendingCorsProbe: AbortController | null = null;

  private volume = 1;
  private muted = false;
  private loop = false;
  private rate = 1;

  setListeners(listeners: EngineEvents): void {
    this.listeners = listeners;
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /** True when the current element is wired to the analyser (real samples available). */
  get isAnalysing(): boolean {
    return this.analyser != null;
  }

  private async probeCors(url: string): Promise<boolean> {
    this.pendingCorsProbe?.abort();
    const controller = new AbortController();
    this.pendingCorsProbe = controller;
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      });
      return response.ok || response.status === 206;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private teardownElement(): void {
    const element = this.element;
    if (!element) return;
    element.pause();
    element.removeAttribute('src');
    try {
      element.load();
    } catch {
      /* the element is already detached; nothing to release */
    }
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.element = null;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.context = new Ctor();
      } catch {
        return null;
      }
    }
    return this.context;
  }

  async load(url: string, mime: string | undefined, wantAnalysis: boolean): Promise<void> {
    this.teardownElement();
    const useAnalysis = wantAnalysis && (await this.probeCors(url));

    const element = new Audio();
    element.preload = 'metadata';
    if (useAnalysis) element.crossOrigin = 'anonymous';
    element.volume = this.muted ? 0 : this.volume;
    element.loop = this.loop;
    element.playbackRate = this.rate;
    element.src = url;
    this.element = element;

    element.addEventListener('timeupdate', () => {
      this.listeners.onTimeUpdate?.(element.currentTime, Number.isFinite(element.duration) ? element.duration : 0);
    });
    element.addEventListener('durationchange', () => {
      this.listeners.onLoaded?.(Number.isFinite(element.duration) ? element.duration : 0, useAnalysis);
    });
    element.addEventListener('play', () => this.listeners.onPlayStateChange?.(true));
    element.addEventListener('pause', () => this.listeners.onPlayStateChange?.(false));
    element.addEventListener('waiting', () => this.listeners.onBuffering?.(true));
    element.addEventListener('playing', () => this.listeners.onBuffering?.(false));
    element.addEventListener('canplay', () => this.listeners.onBuffering?.(false));
    element.addEventListener('ended', () => this.listeners.onEnded?.());
    element.addEventListener('error', () => {
      const code = element.error?.code;
      const message =
        code === 4
          ? 'unsupported'
          : code === 3
            ? 'decode'
            : code === 2
              ? 'network'
              : 'unknown';
      this.listeners.onError?.(message);
    });

    if (useAnalysis) {
      const context = this.ensureContext();
      if (context) {
        try {
          if (context.state === 'suspended') await context.resume();
          const analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.82;
          const source = context.createMediaElementSource(element);
          source.connect(analyser);
          analyser.connect(context.destination);
          this.analyser = analyser;
          this.sourceNode = source;
        } catch {
          // If the graph cannot be built, fall back to plain playback instead of silence.
          this.analyser = null;
          this.sourceNode = null;
        }
      }
    }

    if (mime) element.setAttribute('data-mime', mime);
    element.load();
  }

  async play(): Promise<void> {
    if (!this.element) return;
    if (this.context?.state === 'suspended') await this.context.resume();
    try {
      await this.element.play();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      // Autoplay rejection is a user-gesture problem, not a broken file.
      this.listeners.onError?.(name === 'NotAllowedError' ? 'blocked' : 'playback');
    }
  }

  pause(): void {
    this.element?.pause();
  }

  async toggle(): Promise<void> {
    if (!this.element) return;
    if (this.element.paused) await this.play();
    else this.pause();
  }

  seek(seconds: number): void {
    if (!this.element) return;
    const duration = Number.isFinite(this.element.duration) ? this.element.duration : 0;
    this.element.currentTime = Math.max(0, duration ? Math.min(seconds, duration) : seconds);
  }

  setVolume(next: number): void {
    this.volume = Math.max(0, Math.min(1, next));
    if (this.element) this.element.volume = this.muted ? 0 : this.volume;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    if (this.element) this.element.volume = next ? 0 : this.volume;
  }

  setLoop(next: boolean): void {
    this.loop = next;
    if (this.element) this.element.loop = next;
  }

  setRate(next: number): void {
    this.rate = next;
    if (this.element) this.element.playbackRate = next;
  }

  stop(): void {
    this.teardownElement();
    this.listeners.onPlayStateChange?.(false);
    this.listeners.onTimeUpdate?.(0, 0);
  }

  dispose(): void {
    this.teardownElement();
    this.pendingCorsProbe?.abort();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}

export const audioEngine = new AudioEngine();
