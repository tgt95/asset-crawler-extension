export type AssetType = 'image' | 'svg' | 'video' | 'audio' | 'icon' | 'other';

export type AssetSourceKind = 'remote' | 'inline';

export type NameSource = 'svg-title' | 'use-href' | 'aria-label' | 'data-attribute' | 'nearby-text' | 'class-name' | 'fallback';

export type NameConfidence = 'high' | 'medium' | 'low' | 'fallback';

export type DiscoveredAsset = {
  id: string;
  type: AssetType;
  sourceKind: AssetSourceKind;
  tagName: string;
  url?: string;
  inlineContent?: string;
  thumbnailUrl?: string;
  fileName: string;
  originalFileName?: string;
  inferredName?: string;
  nameSource?: NameSource;
  nameConfidence?: NameConfidence;
  extension: string;
  width?: number;
  height?: number;
};

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'complete' | 'error';

export type DownloadableAsset = DiscoveredAsset & {
  status?: DownloadStatus;
};

export type DownloadAssetRequest = {
  type: 'DOWNLOAD_ASSETS';
  assets: DiscoveredAsset[];
  folderPath: string;
};

export type DownloadAssetResponse = {
  ok: boolean;
  results: Array<{
    assetId: string;
    downloadId?: number;
    filename: string;
    error?: string;
  }>;
};
