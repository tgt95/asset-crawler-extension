import { describe, expect, it } from 'vitest';

import { ensureSvgFileName, inferIconName, makeUniqueFileName, normalizeIconName, sourceLabel } from '../src/lib/icon-naming';

describe('icon naming', () => {
  it('infers names from svg title', () => {
    expect(inferIconName([{ value: 'Arrow Left', source: 'svg-title', confidence: 'high' }], 'inline-svg-1')).toEqual({
      name: 'arrow-left',
      fileName: 'arrow-left.svg',
      source: 'svg-title',
      confidence: 'high',
    });
  });

  it('infers names from use href references', () => {
    expect(inferIconName([{ value: '#icon-heart', source: 'use-href', confidence: 'high' }], 'inline-svg-1').fileName).toBe('heart.svg');
  });

  it('infers names from aria labels and data attributes', () => {
    expect(inferIconName([{ value: 'Search', source: 'aria-label', confidence: 'high' }], 'inline-svg-1').fileName).toBe('search.svg');
    expect(inferIconName([{ value: 'new icon', source: 'data-attribute', confidence: 'high' }], 'inline-svg-1').fileName).toBe('new-icon.svg');
  });

  it('uses nearby hidden labels before noisy class names', () => {
    const result = inferIconName(
      [
        { value: 'absolute bottom-2 leading-none text-center', source: 'class-name', confidence: 'low' },
        { value: 'New Icon', source: 'nearby-text', confidence: 'medium' },
      ],
      'inline-svg-1',
    );

    expect(result.fileName).toBe('new-icon.svg');
    expect(result.source).toBe('nearby-text');
  });

  it('falls back when no useful metadata exists', () => {
    expect(inferIconName([{ value: 'absolute flex icon', source: 'class-name', confidence: 'low' }], 'inline-svg-1')).toEqual({
      name: 'inline-svg-1',
      fileName: 'inline-svg-1.svg',
      source: 'fallback',
      confidence: 'fallback',
    });
  });

  it('sanitizes and deduplicates svg file names', () => {
    const usedNames = new Map<string, number>();

    expect(normalizeIconName('Folder/Icon Name.svg')).toBe('folder-icon-name');
    expect(ensureSvgFileName('Arrow_Left')).toBe('arrow-left.svg');
    expect(makeUniqueFileName('arrow-left.svg', usedNames)).toBe('arrow-left.svg');
    expect(makeUniqueFileName('arrow-left.svg', usedNames)).toBe('arrow-left-2.svg');
  });

  it('maps name sources to labels', () => {
    expect(sourceLabel('svg-title')).toBe('from svg title');
    expect(sourceLabel('nearby-text')).toBe('from nearby label');
    expect(sourceLabel('fallback')).toBe('fallback name');
  });
});
