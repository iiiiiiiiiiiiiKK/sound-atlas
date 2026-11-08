import { useEffect, useRef, useState } from 'react';

interface WaveformProps {
  /** Live analyser, when the audio host allows real analysis. */
  analyser: AnalyserNode | null;
  playing: boolean;
  /** Seconds of known length, used for the fallback rendering. */
  duration: number;
  currentTime: number;
  onSeek?: (seconds: number) => void;
  height?: number;
  bars?: number;
  /** Stable seed so a fallback shape does not flicker between renders. */
  seed?: string;
  className?: string;
  color?: string;
}

/**
 * Draws either the real frequency data from the analyser, or — when the audio host
 * refuses CORS — a deterministic placeholder shape derived from the sound id. The
 * placeholder is never presented as measured spectrum: the player shows a note saying
 * analysis is unavailable.
 */
export function Waveform({
  analyser,
  playing,
  duration,
  currentTime,
  onSeek,
  height = 56,
  bars = 64,
  seed = 'seed',
  className,
  color = 'var(--accent)',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const levelsRef = useRef<number[]>(new Array(bars).fill(0.08));
  const [fallback, setFallback] = useState<number[]>(() => buildFallback(bars, seed));

  useEffect(() => {
    setFallback(buildFallback(bars, seed));
  }, [bars, seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const buffer = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const levels = levelsRef.current;
      if (analyser && buffer && playing) {
        analyser.getByteFrequencyData(buffer as Uint8Array<ArrayBuffer>);
        const usable = Math.floor(buffer.length * 0.72);
        for (let i = 0; i < bars; i += 1) {
          const from = Math.floor((i / bars) * usable);
          const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * usable));
          let sum = 0;
          for (let j = from; j < to; j += 1) sum += buffer[j] ?? 0;
          const average = sum / (to - from) / 255;
          levels[i] = Math.max(0.05, Math.min(1, average * 1.35));
        }
      } else if (playing && analyser) {
        for (let i = 0; i < bars; i += 1) levels[i] = Math.max(0.04, (levels[i] ?? 0.05) * 0.94);
      } else if (!analyser) {
        for (let i = 0; i < bars; i += 1) levels[i] = fallback[i] ?? 0.1;
      }

      const barWidth = width / bars;
      for (let i = 0; i < bars; i += 1) {
        const level = levels[i] ?? 0.05;
        const barHeight = Math.max(2, level * height * 0.94);
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        const progress = duration > 0 ? currentTime / duration : 0;
        const played = i / bars <= progress;
        context.fillStyle = played ? color : 'rgba(140,152,168,0.32)';
        context.globalAlpha = played ? 0.95 : 0.55;
        context.beginPath();
        const radius = Math.min(2, barWidth / 2);
        const w = Math.max(1.5, barWidth - Math.max(1, barWidth * 0.34));
        roundedRect(context, x + (barWidth - w) / 2, y, w, barHeight, radius);
        context.fill();
      }
      context.globalAlpha = 1;

      if (playing || analyser) frameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [analyser, playing, bars, height, fallback, duration, currentTime, color]);

  const seekFromEvent = (clientX: number) => {
    if (!onSeek || !duration) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <canvas
      ref={canvasRef}
      role={onSeek ? 'slider' : 'img'}
      aria-label="Audio waveform"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      tabIndex={onSeek ? 0 : -1}
      onPointerDown={(event) => {
        if (!onSeek) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromEvent(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!onSeek || event.buttons !== 1) return;
        seekFromEvent(event.clientX);
      }}
      onKeyDown={(event) => {
        if (!onSeek || !duration) return;
        if (event.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
      }}
      style={{ width: '100%', height, cursor: onSeek ? 'pointer' : 'default', touchAction: 'none' }}
      className={className}
    />
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

/** Deterministic pseudo-random envelope, seeded by a string. */
function buildFallback(bars: number, seed: string): number[] {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  const values: number[] = [];
  for (let i = 0; i < bars; i += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    const noise = state / 0xffffffff;
    const envelope = 0.45 + 0.55 * Math.sin((i / bars) * Math.PI);
    values.push(Math.max(0.08, Math.min(1, 0.2 + noise * 0.75 * envelope)));
  }
  return values;
}
