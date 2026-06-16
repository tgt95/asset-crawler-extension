import { buildDownloadFilename, sanitizeFolderPath } from '@/lib/assets';
import type { DownloadAssetRequest, DownloadAssetResponse, DiscoveredAsset } from '@/lib/types';

chrome.runtime.onMessage.addListener((message: DownloadAssetRequest, _sender, sendResponse) => {
  if (message?.type !== 'DOWNLOAD_ASSETS') {
    return false;
  }

  downloadAssets(message.assets, message.folderPath)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        results: [
          {
            assetId: 'unknown',
            filename: '',
            error: error instanceof Error ? error.message : 'Download failed.',
          },
        ],
      } satisfies DownloadAssetResponse);
    });

  return true;
});

async function downloadAssets(assets: DiscoveredAsset[], folderPath: string): Promise<DownloadAssetResponse> {
  const folder = sanitizeFolderPath(folderPath);
  if (!folder.ok) {
    return {
      ok: false,
      results: assets.map((asset) => ({
        assetId: asset.id,
        filename: asset.fileName,
        error: folder.error,
      })),
    };
  }

  const results: DownloadAssetResponse['results'] = [];

  for (const asset of assets) {
    const filename = buildDownloadFilename(asset, folder.value);

    try {
      const url = asset.sourceKind === 'inline' ? svgDataUrl(asset.inlineContent ?? '') : asset.url;
      if (!url) {
        throw new Error('Asset has no downloadable URL.');
      }

      const downloadId = await download({ url, filename });
      results.push({ assetId: asset.id, downloadId, filename });
    } catch (error) {
      results.push({
        assetId: asset.id,
        filename,
        error: error instanceof Error ? error.message : 'Chrome rejected this download.',
      });
    }
  }

  return {
    ok: results.every((result) => !result.error),
    results,
  };
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function download(options: chrome.downloads.DownloadOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ ...options, conflictAction: 'uniquify' }, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(downloadId);
    });
  });
}
