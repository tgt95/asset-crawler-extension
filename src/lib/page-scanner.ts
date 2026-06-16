import type { AssetType, DiscoveredAsset } from './types';

export function scanCurrentPage(): DiscoveredAsset[] {
  type DraftAsset = Omit<DiscoveredAsset, 'id'>;

  const assets: DraftAsset[] = [];
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
    assets.push({
      type,
      sourceKind: 'remote',
      tagName,
      url,
      fileName: fileNameFromSource(url, fallbackName, type),
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

    assets.push({
      type: 'svg',
      sourceKind: 'inline',
      tagName: 'SVG',
      inlineContent,
      fileName: `inline-svg-${index + 1}.svg`,
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
