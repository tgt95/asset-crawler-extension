import { describe, expect, it } from 'vitest';

import {
  buildDownloadFilename,
  buildFileName,
  dedupeAssets,
  filterAssets,
  inferExtension,
  sanitizeFileName,
  sanitizeFolderPath,
} from '../src/lib/assets';
import type { DiscoveredAsset } from '../src/lib/types';

const sampleAssets: DiscoveredAsset[] = [
  {
    id: 'one',
    type: 'image',
    sourceKind: 'remote',
    tagName: 'IMG',
    url: 'https://example.com/media/hero-card.webp',
    fileName: 'hero-card.webp',
    extension: 'webp',
  },
  {
    id: 'two',
    type: 'svg',
    sourceKind: 'inline',
    tagName: 'SVG',
    inlineContent: '<svg viewBox="0 0 12 12"></svg>',
    fileName: 'inline-svg-1.svg',
    extension: 'svg',
  },
  {
    id: 'three',
    type: 'video',
    sourceKind: 'remote',
    tagName: 'SOURCE',
    url: 'https://cdn.example.com/trailer.mp4',
    fileName: 'trailer.mp4',
    extension: 'mp4',
  },
];

describe('asset utilities', () => {
  it('filters by name, extension, URL, tag, and type', () => {
    expect(filterAssets(sampleAssets, 'hero', new Set()).map((asset) => asset.id)).toEqual(['one']);
    expect(filterAssets(sampleAssets, 'svg', new Set()).map((asset) => asset.id)).toEqual(['two']);
    expect(filterAssets(sampleAssets, 'cdn.example', new Set()).map((asset) => asset.id)).toEqual(['three']);
    expect(filterAssets(sampleAssets, 'source', new Set()).map((asset) => asset.id)).toEqual(['three']);
    expect(filterAssets(sampleAssets, '', new Set(['image'])).map((asset) => asset.id)).toEqual(['one']);
  });

  it('validates Downloads-relative folder paths', () => {
    expect(sanitizeFolderPath(' campaign/assets/ ')).toEqual({ ok: true, value: 'campaign/assets' });
    expect(sanitizeFolderPath('')).toEqual({ ok: true, value: '' });
    expect(sanitizeFolderPath('/Users/admin/Downloads')).toMatchObject({ ok: false });
    expect(sanitizeFolderPath('C:/Users/admin/Downloads')).toMatchObject({ ok: false });
    expect(sanitizeFolderPath('../assets')).toMatchObject({ ok: false });
    expect(sanitizeFolderPath('assets//icons')).toMatchObject({ ok: false });
  });

  it('sanitizes file names and infers extensions', () => {
    expect(sanitizeFileName('https://example.com/a/b/hero%20shot.png?cache=1')).toBe('hero shot.png');
    expect(sanitizeFileName('bad:name*asset.svg')).toBe('bad-name-asset.svg');
    expect(inferExtension('https://example.com/clip.webm?x=1', 'video')).toBe('webm');
    expect(inferExtension('https://example.com/asset', 'svg')).toBe('svg');
    expect(buildFileName('https://example.com/media/brand', 'image', 'asset')).toBe('brand.png');
  });

  it('deduplicates by URL or inline content', () => {
    const unique = dedupeAssets([
      sampleAssets[0],
      { ...sampleAssets[0], id: 'duplicate' },
      sampleAssets[1],
      { ...sampleAssets[1], id: 'duplicate-inline' },
    ]);

    expect(unique.map((asset) => asset.id)).toEqual(['one', 'two']);
  });

  it('builds safe Chrome download filenames', () => {
    expect(buildDownloadFilename(sampleAssets[0], 'site-assets')).toBe('site-assets/hero-card.webp');
    expect(buildDownloadFilename({ ...sampleAssets[0], fileName: 'hero-card' }, '')).toBe('hero-card.webp');
  });
});
