import type { NameConfidence, NameSource } from './types';

export type IconNameCandidate = {
  value: string | null | undefined;
  source: NameSource;
  confidence: NameConfidence;
};

export type IconNameResult = {
  name: string;
  fileName: string;
  source: NameSource;
  confidence: NameConfidence;
};

const SOURCE_RANK: Record<NameSource, number> = {
  'svg-title': 0,
  'use-href': 1,
  'aria-label': 2,
  'data-attribute': 3,
  'nearby-text': 4,
  'class-name': 5,
  fallback: 6,
};

const CONFIDENCE_RANK: Record<NameConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
  fallback: 3,
};

const NOISE_TOKENS = new Set([
  'absolute',
  'active',
  'body',
  'block',
  'border',
  'bottom',
  'button',
  'center',
  'class',
  'current',
  'dark',
  'disabled',
  'flex',
  'focus',
  'full',
  'group',
  'height',
  'hidden',
  'hover',
  'icon',
  'inline',
  'inset',
  'item',
  'justify',
  'label',
  'leading',
  'left',
  'none',
  'opacity',
  'outline',
  'relative',
  'right',
  'rounded',
  'selected',
  'shadow',
  'size',
  'slot',
  'square',
  'text',
  'top',
  'truncate',
  'view',
  'white',
  'width',
]);

export function inferIconName(candidates: IconNameCandidate[], fallbackBase: string): IconNameResult {
  const fallbackName = normalizeIconName(fallbackBase) || fallbackBase;
  const normalized = candidates
    .map((candidate) => ({
      ...candidate,
      name: normalizeIconName(candidate.value ?? ''),
    }))
    .filter((candidate) => candidate.name && !isNoiseName(candidate.name));

  normalized.sort((a, b) => {
    const confidenceDelta = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (confidenceDelta !== 0) return confidenceDelta;
    return SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
  });

  const best = normalized[0];
  if (!best) {
    return {
      name: fallbackName,
      fileName: ensureSvgFileName(fallbackName),
      source: 'fallback',
      confidence: 'fallback',
    };
  }

  return {
    name: best.name,
    fileName: ensureSvgFileName(best.name),
    source: best.source,
    confidence: best.confidence,
  };
}

export function normalizeIconName(value: string): string {
  const withoutExtension = value
    .replace(/^#/, '')
    .replace(/^icon[-_:]/i, '')
    .replace(/^svg[-_:]/i, '')
    .replace(/\.(svg|png|webp|jpg|jpeg|gif|ico)$/i, '');

  return withoutExtension
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

export function ensureSvgFileName(name: string): string {
  const normalized = normalizeIconName(name) || 'inline-svg';
  return `${normalized}.svg`;
}

export function makeUniqueFileName(fileName: string, usedNames: Map<string, number>): string {
  const normalizedFileName = ensureSvgFileName(fileName);
  const count = usedNames.get(normalizedFileName) ?? 0;
  usedNames.set(normalizedFileName, count + 1);

  if (count === 0) {
    return normalizedFileName;
  }

  return normalizedFileName.replace(/\.svg$/i, `-${count + 1}.svg`);
}

export function sourceLabel(source?: NameSource): string | undefined {
  if (!source || source === 'fallback') return 'fallback name';

  const labels: Record<Exclude<NameSource, 'fallback'>, string> = {
    'svg-title': 'from svg title',
    'use-href': 'from sprite reference',
    'aria-label': 'from aria label',
    'data-attribute': 'from data attribute',
    'nearby-text': 'from nearby label',
    'class-name': 'from class name',
  };

  return labels[source];
}

function isNoiseName(name: string): boolean {
  if (name.length < 2) return true;
  if (/^\d+$/.test(name)) return true;
  return name.split('-').every((token) => NOISE_TOKENS.has(token) || /^\d+$/.test(token));
}
