import type { AssetType, DiscoveredAsset } from './types';

export function scanCurrentPage(): DiscoveredAsset[] {
  type DraftAsset = Omit<DiscoveredAsset, 'id'>;
  type NameSource = 'svg-title' | 'use-href' | 'aria-label' | 'data-attribute' | 'nearby-text' | 'class-name' | 'fallback';
  type NameConfidence = 'high' | 'medium' | 'low' | 'fallback';
  type IconNameCandidate = {
    value: string | null | undefined;
    source: NameSource;
    confidence: NameConfidence;
  };

  const assets: DraftAsset[] = [];
  const usedInlineFileNames = new Map<string, number>();
  const imageExtensions = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
  const videoExtensions = new Set(['m4v', 'mov', 'mp4', 'ogg', 'ogv', 'webm']);
  const audioExtensions = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba']);

  function absoluteUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined;

    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return undefined;
    }
  }

  function extensionFromSource(source: string, fallback: AssetType): string {
    const pathname = source.split(/[?#]/)[0] ?? '';
    const match = pathname.match(/\.([a-z0-9]{1,8})$/i);
    if (match) return match[1].toLowerCase();
    if (fallback === 'svg') return 'svg';
    if (fallback === 'icon') return 'ico';
    if (fallback === 'video') return 'mp4';
    if (fallback === 'audio') return 'mp3';
    if (fallback === 'image') return 'png';
    return 'bin';
  }

  function typeFromSource(source: string, fallback: AssetType): AssetType {
    const extension = extensionFromSource(source, fallback);
    if (extension === 'svg') return 'svg';
    if (extension === 'ico') return 'icon';
    if (imageExtensions.has(extension)) return 'image';
    if (videoExtensions.has(extension)) return 'video';
    if (audioExtensions.has(extension)) return 'audio';
    return fallback;
  }

  function fileNameFromSource(source: string, fallback: string, type: AssetType): string {
    let candidate = fallback;
    try {
      const url = new URL(source, document.baseURI);
      const segment = url.pathname.split('/').filter(Boolean).pop();
      if (segment) candidate = decodeURIComponent(segment);
    } catch {
      const segment = source.split(/[?#]/)[0]?.split('/').filter(Boolean).pop();
      if (segment) candidate = segment;
    }

    candidate = candidate
      .replace(/[<>:"|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    const extension = extensionFromSource(source, type);
    return /\.[a-z0-9]{1,8}$/i.test(candidate) ? candidate : `${candidate || fallback}.${extension}`;
  }

  function pushRemote(rawUrl: string | null | undefined, fallbackType: AssetType, tagName: string, fallbackName: string, width?: number, height?: number) {
    const url = absoluteUrl(rawUrl);
    if (!url) return;

    const type = typeFromSource(url, fallbackType);
    const fileName = fileNameFromSource(url, fallbackName, type);
    assets.push({
      type,
      sourceKind: 'remote',
      tagName,
      url,
      thumbnailUrl: type === 'image' || type === 'svg' || type === 'icon' || type === 'video' ? url : undefined,
      fileName,
      originalFileName: fileName,
      nameSource: 'fallback',
      nameConfidence: 'fallback',
      extension: extensionFromSource(url, type),
      width,
      height,
    });
  }

  function srcsetUrls(srcset: string | null | undefined): string[] {
    if (!srcset) return [];

    return srcset
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  function normalizeIconName(value: string): string {
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

  function ensureSvgFileName(name: string): string {
    return `${normalizeIconName(name) || 'inline-svg'}.svg`;
  }

  function isNoiseName(name: string): boolean {
    const noiseTokens = new Set([
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

    if (name.length < 2 || /^\d+$/.test(name)) return true;
    return name.split('-').every((token) => noiseTokens.has(token) || /^\d+$/.test(token));
  }

  function inferIconName(candidates: IconNameCandidate[], fallbackBase: string) {
    const sourceRank: Record<NameSource, number> = {
      'svg-title': 0,
      'use-href': 1,
      'aria-label': 2,
      'data-attribute': 3,
      'nearby-text': 4,
      'class-name': 5,
      fallback: 6,
    };
    const confidenceRank: Record<NameConfidence, number> = {
      high: 0,
      medium: 1,
      low: 2,
      fallback: 3,
    };
    const normalized = candidates
      .map((candidate) => ({ ...candidate, name: normalizeIconName(candidate.value ?? '') }))
      .filter((candidate) => candidate.name && !isNoiseName(candidate.name));

    normalized.sort((a, b) => {
      const confidenceDelta = confidenceRank[a.confidence] - confidenceRank[b.confidence];
      if (confidenceDelta !== 0) return confidenceDelta;
      return sourceRank[a.source] - sourceRank[b.source];
    });

    const best = normalized[0];
    if (!best) {
      return {
        name: normalizeIconName(fallbackBase) || fallbackBase,
        source: 'fallback' as NameSource,
        confidence: 'fallback' as NameConfidence,
      };
    }

    return {
      name: best.name,
      source: best.source,
      confidence: best.confidence,
    };
  }

  function makeUniqueSvgFileName(fileName: string): string {
    const normalizedFileName = ensureSvgFileName(fileName);
    const count = usedInlineFileNames.get(normalizedFileName) ?? 0;
    usedInlineFileNames.set(normalizedFileName, count + 1);

    if (count === 0) {
      return normalizedFileName;
    }

    return normalizedFileName.replace(/\.svg$/i, `-${count + 1}.svg`);
  }

  function textFromLabelledBy(svg: SVGSVGElement): string | undefined {
    const labelledBy = svg.getAttribute('aria-labelledby');
    if (!labelledBy) return undefined;

    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
  }

  function explicitAttributeCandidates(element: Element | null): IconNameCandidate[] {
    if (!element) return [];

    return [
      { value: element.getAttribute('data-icon-name'), source: 'data-attribute', confidence: 'high' },
      { value: element.getAttribute('data-icon'), source: 'data-attribute', confidence: 'high' },
      { value: element.getAttribute('data-name'), source: 'data-attribute', confidence: 'high' },
      { value: element.getAttribute('title'), source: 'data-attribute', confidence: 'medium' },
      { value: element.getAttribute('data-testid'), source: 'data-attribute', confidence: 'medium' },
      { value: element.getAttribute('aria-label'), source: 'aria-label', confidence: 'high' },
    ];
  }

  function nearbyTextCandidate(svg: SVGSVGElement): IconNameCandidate | undefined {
    const container = svg.closest('li, button, a, [role="button"], [data-slot], [data-icon], [data-name], [aria-label], .group') ?? svg.parentElement;
    if (!container) return undefined;

    const clone = container.cloneNode(true) as Element;
    clone.querySelectorAll('svg, img, video, audio, script, style').forEach((node) => node.remove());
    const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 60) return undefined;

    return { value: text, source: 'nearby-text', confidence: 'medium' };
  }

  function classNameCandidates(svg: SVGSVGElement): IconNameCandidate[] {
    const classNames = [svg.getAttribute('class'), svg.parentElement?.getAttribute('class')]
      .filter(Boolean)
      .join(' ')
      .split(/\s+/);

    return classNames
      .filter((className) => /(?:^|[-_:])(icon|svg)[-_:][a-z0-9_-]+|[a-z0-9_-]+[-_:](?:icon|svg)(?:$|[-_:])/i.test(className))
      .map((className) => ({ value: className, source: 'class-name' as NameSource, confidence: 'low' as NameConfidence }));
  }

  function inlineSvgName(svg: SVGSVGElement, index: number) {
    const fallbackBase = `inline-svg-${index + 1}`;
    const useElement = svg.querySelector('use');
    const useHref = useElement?.getAttribute('href') || useElement?.getAttribute('xlink:href');
    const ancestors: Element[] = [];
    let current: Element | null = svg;

    for (let depth = 0; current && depth < 4; depth += 1) {
      ancestors.push(current);
      current = current.parentElement;
    }

    const candidates: IconNameCandidate[] = [
      { value: svg.querySelector('title')?.textContent?.trim(), source: 'svg-title', confidence: 'high' },
      { value: useHref?.split('#').pop(), source: 'use-href', confidence: 'high' },
      { value: svg.getAttribute('aria-label'), source: 'aria-label', confidence: 'high' },
      { value: textFromLabelledBy(svg), source: 'aria-label', confidence: 'high' },
      { value: svg.id, source: 'data-attribute', confidence: 'medium' },
      ...ancestors.flatMap((element) => explicitAttributeCandidates(element)),
      nearbyTextCandidate(svg),
      ...classNameCandidates(svg),
    ].filter(Boolean) as IconNameCandidate[];

    const result = inferIconName(candidates, fallbackBase);
    const fileName = makeUniqueSvgFileName(result.name);

    return {
      ...result,
      fileName,
      fallbackFileName: `${fallbackBase}.svg`,
    };
  }

  document.querySelectorAll('img').forEach((element, index) => {
    const img = element as HTMLImageElement;
    pushRemote(img.currentSrc || img.src, 'image', 'IMG', `image-${index + 1}`, img.naturalWidth || img.width, img.naturalHeight || img.height);
    srcsetUrls(img.getAttribute('srcset')).forEach((url, sourceIndex) => {
      pushRemote(url, 'image', 'IMG', `image-${index + 1}-${sourceIndex + 1}`, img.naturalWidth || img.width, img.naturalHeight || img.height);
    });
  });

  document.querySelectorAll('picture source[srcset]').forEach((element, index) => {
    srcsetUrls(element.getAttribute('srcset')).forEach((url, sourceIndex) => {
      pushRemote(url, 'image', 'SOURCE', `picture-source-${index + 1}-${sourceIndex + 1}`);
    });
  });

  document.querySelectorAll('svg').forEach((element, index) => {
    const svg = element as SVGSVGElement;
    const inlineContent = new XMLSerializer().serializeToString(svg);
    const width = Number(svg.getAttribute('width')) || Math.round(svg.getBoundingClientRect().width) || undefined;
    const height = Number(svg.getAttribute('height')) || Math.round(svg.getBoundingClientRect().height) || undefined;
    const name = inlineSvgName(svg, index);

    assets.push({
      type: 'svg',
      sourceKind: 'inline',
      tagName: 'SVG',
      inlineContent,
      thumbnailUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inlineContent)}`,
      fileName: name.fileName,
      originalFileName: name.fallbackFileName,
      inferredName: name.name,
      nameSource: name.source,
      nameConfidence: name.confidence,
      extension: 'svg',
      width,
      height,
    });
  });

  document.querySelectorAll('video').forEach((element, index) => {
    const video = element as HTMLVideoElement;
    pushRemote(video.currentSrc || video.src, 'video', 'VIDEO', `video-${index + 1}`, video.videoWidth, video.videoHeight);
    pushRemote(video.poster, 'image', 'VIDEO', `video-poster-${index + 1}`, video.videoWidth, video.videoHeight);
  });

  document.querySelectorAll('audio').forEach((element, index) => {
    const audio = element as HTMLAudioElement;
    pushRemote(audio.currentSrc || audio.src, 'audio', 'AUDIO', `audio-${index + 1}`);
  });

  document.querySelectorAll('source, track, embed, object').forEach((element, index) => {
    const tagName = element.tagName.toUpperCase();
    const source = element.getAttribute('src') || element.getAttribute('data');
    const parentTag = element.parentElement?.tagName.toUpperCase();
    const fallbackType: AssetType = tagName === 'SOURCE' && parentTag === 'AUDIO' ? 'audio' : tagName === 'SOURCE' ? 'video' : 'other';
    pushRemote(source, fallbackType, tagName, `${tagName.toLowerCase()}-${index + 1}`);
  });

  document.querySelectorAll('link[rel]').forEach((element, index) => {
    const link = element as HTMLLinkElement;
    const rel = link.rel.toLowerCase();
    if (!/(icon|apple-touch-icon|mask-icon|image_src|preload)/.test(rel)) return;

    const asValue = (link.getAttribute('as') ?? '').toLowerCase();
    const fallbackType: AssetType = rel.includes('icon') ? 'icon' : asValue === 'image' ? 'image' : 'other';
    pushRemote(link.href, fallbackType, 'LINK', `link-asset-${index + 1}`);
  });

  const seen = new Set<string>();
  return assets.reduce<DiscoveredAsset[]>((result, asset, index) => {
    const signature = asset.url ? `url:${asset.url}` : `inline:${asset.inlineContent ?? index}`;
    if (seen.has(signature)) return result;
    seen.add(signature);

    result.push({
      ...asset,
      id: hashSignature(signature),
    });

    return result;
  }, []);

  function hashSignature(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
