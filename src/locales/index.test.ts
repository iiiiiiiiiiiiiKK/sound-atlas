import { describe, expect, it } from 'vitest';
import { detectLang, makeTranslator } from '@/locales';

describe('translator', () => {
  const en = makeTranslator('en');
  const zh = makeTranslator('zh');

  it('returns the English string', () => {
    expect(en('brand.tagline')).toBe('Listen to the world.');
  });

  it('returns the Chinese string', () => {
    expect(zh('brand.tagline')).toBe('用耳朵，重新认识这个世界。');
  });

  it('interpolates variables', () => {
    expect(en('explore.showing', { shown: 3, total: 9 })).toBe('Showing 3 of 9');
    expect(zh('collections.count', { n: 4 })).toBe('4 段声音');
  });

  it('leaves unknown placeholders untouched instead of printing undefined', () => {
    expect(en('explore.showing', { shown: 3 })).toBe('Showing 3 of {total}');
  });

  it('falls back to English, then to the key', () => {
    expect(zh('home.eyebrow')).toBe('全球环境声音档案');
    expect(zh('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('covers every category label in both languages', () => {
    const keys = [
      'category.nature',
      'category.weather',
      'category.rain',
      'category.water',
      'category.animal',
      'category.human',
      'category.traffic',
      'category.transport',
      'category.architecture',
      'category.city',
    ];
    for (const key of keys) {
      expect(en(key)).not.toBe(key);
      expect(zh(key)).not.toBe(key);
    }
  });
});

describe('detectLang', () => {
  it('returns one of the supported languages', () => {
    expect(['en', 'zh']).toContain(detectLang());
  });
});
