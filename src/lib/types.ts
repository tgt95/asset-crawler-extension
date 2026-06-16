export type AssetType = 'image' | 'svg' | 'video' | 'audio' | 'icon' | 'other';

export type AssetSourceKind = 'remote' | 'inline';

export type DiscoveredAsset = {
  id: string;
  type: AssetType;
  sourceKind: AssetSourceKind;
  tagName: string;
  url?: string;
  inlineContent?: string;
  fileName: string;
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
