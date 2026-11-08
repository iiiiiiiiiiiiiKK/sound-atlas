import { describe, expect, it } from 'vitest';
import { formatBytes, formatClock, formatDuration, seededShuffle, clamp, newId } from '@/utils/format';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3672)).toBe('1:01:12');
  });

  it('reports unknown lengths without inventing a number', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(null, 'zh')).toBe('未知');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-4)).toBe('—');
  });
});

describe('formatClock', () => {
  it('never renders negatives or NaN', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-10)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(125.7)).toBe('2:05');
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(input, 42)).toEqual(seededShuffle(input, 42));
  });

  it('does not mutate the input and keeps every item', () => {
    const input = ['a', 'b', 'c', 'd'];
    const output = seededShuffle(input, 7);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
    expect([...output].sort()).toEqual([...input].sort());
  });

  it('produces a different order for a different seed', () => {
    const input = Array.from({ length: 20 }, (_, index) => index);
    expect(seededShuffle(input, 1)).not.toEqual(seededShuffle(input, 2));
  });
});

describe('clamp', () => {
  it('bounds the value', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('newId', () => {
  it('is unique and prefixed', () => {
    const first = newId('map');
    const second = newId('map');
    expect(first.startsWith('map_')).toBe(true);
    expect(first).not.toBe(second);
  });
});
