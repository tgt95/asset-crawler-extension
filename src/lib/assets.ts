import type { AssetType, DiscoveredAsset } from './types';

const EXTENSION_RE = /\.([a-z0-9]{1,8})(?:[?#].*)?$/i;
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogg', 'ogv', 'webm']);
const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba']);

export type FolderValidation =
  | { ok: true; value: string }
  | { ok: false; value: string; error: string };

export function sanitizeFolderPath(input: string): FolderValidation {
  const value = input.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  if (!value) {
    return { ok: true, value: '' };
  }

  if (/^[a-zA-Z]:\//.test(value) || input.trim().startsWith('/')) {
    return { ok: false, value, error: 'Use a folder relative to Downloads, not an absolute path.' };
  }

  if (value.split('/').some((segment) => segment === '..')) {
    return { ok: false, value, error: 'Folder paths cannot include "..".' };
  }

  if (value.split('/').some((segment) => !segment || segment === '.')) {
    return { ok: false, value, error: 'Folder paths cannot contain empty or current-directory segments.' };
  }

  const safe = value
    .split('/')
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/');

  return { ok: true, value: safe };
}

export function sanitizeFileName(input: string, fallback = 'asset'): string {
  const withoutQuery = input.split(/[?#]/)[0] || fallback;
  const lastSegment = withoutQuery.split('/').filter(Boolean).pop() || fallback;
  const decoded = safeDecode(lastSegment);
  const cleaned = sanitizePathSegment(decoded).replace(/^\.+/, '');
  return cleaned || fallback;
}

export function inferExtension(source: string, type: AssetType): string {
  const match = source.match(EXTENSION_RE);
  if (match) {
    return match[1].toLowerCase();
  }

  if (type === 'svg') return 'svg';
  if (type === 'icon') return 'ico';
  if (type === 'video') return 'mp4';
  if (type === 'audio') return 'mp3';
  if (type === 'image') return 'png';
  return 'bin';
}

export function inferTypeFromSource(source: string, fallback: AssetType = 'other'): AssetType {
  const extension = inferExtension(source, fallback);

  if (extension === 'svg') return 'svg';
  if (extension === 'ico') return 'icon';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  return fallback;
}

export function buildFileName(source: string, type: AssetType, fallbackBase: string): string {
  const extension = inferExtension(source, type);
  const name = sanitizeFileName(source, fallbackBase);
  const hasExtension = EXTENSION_RE.test(name);

  return hasExtension ? name : `${name}.${extension}`;
}

export function buildDownloadFilename(asset: DiscoveredAsset, folderPath: string): string {
  const folder = sanitizeFolderPath(folderPath);
  const safeFile = ensureExtension(sanitizeFileName(asset.fileName, `${asset.type}-${asset.id}`), asset.extension);

  if (!folder.ok || !folder.value) {
    return safeFile;
  }

  return `${folder.value}/${safeFile}`;
}

export function filterAssets(assets: DiscoveredAsset[], query: string, activeTypes: Set<AssetType>): DiscoveredAsset[] {
  const normalized = query.trim().toLowerCase();

  return assets.filter((asset) => {
    if (activeTypes.size > 0 && !activeTypes.has(asset.type)) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    return [asset.fileName, asset.extension, asset.type, asset.tagName, asset.url ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalized);
  });
}

export function dedupeAssets(assets: DiscoveredAsset[]): DiscoveredAsset[] {
  const seen = new Set<string>();
  const unique: DiscoveredAsset[] = [];

  for (const asset of assets) {
    const signature = asset.url ? `url:${asset.url}` : `inline:${asset.inlineContent ?? asset.id}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    unique.push(asset);
  }

  return unique;
}

function ensureExtension(fileName: string, extension: string): string {
  if (EXTENSION_RE.test(fileName)) {
    return fileName;
  }

  return `${fileName}.${extension || 'bin'}`;
}

function sanitizePathSegment(segment: string): string {
  return segment
    .replace(/[<>:"|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
