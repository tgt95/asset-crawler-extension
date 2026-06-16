import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cross2Icon,
  DownloadIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { dedupeAssets, filterAssets, sanitizeFolderPath } from '@/lib/assets';
import { scanCurrentPage } from '@/lib/page-scanner';
import type { AssetType, DiscoveredAsset, DownloadAssetRequest, DownloadAssetResponse, DownloadStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STORAGE_FOLDER_KEY = 'assetCrawler:lastFolderPath';
const ASSET_TYPES: AssetType[] = ['image', 'svg', 'video', 'audio', 'icon', 'other'];

type ScanState = 'idle' | 'loading' | 'ready' | 'error';

export function App() {
  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<AssetType>>(() => new Set());
  const [folderPath, setFolderPath] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [error, setError] = useState('');
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({});

  const folderValidation = useMemo(() => sanitizeFolderPath(folderPath), [folderPath]);

  const filteredAssets = useMemo(() => filterAssets(assets, query, activeTypes), [assets, activeTypes, query]);
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedIds.has(asset.id)), [assets, selectedIds]);
  const allFilteredSelected = filteredAssets.length > 0 && filteredAssets.every((asset) => selectedIds.has(asset.id));

  const assetCounts = useMemo(() => {
    return assets.reduce<Record<AssetType, number>>(
      (counts, asset) => {
        counts[asset.type] += 1;
        return counts;
      },
      { image: 0, svg: 0, video: 0, audio: 0, icon: 0, other: 0 },
    );
  }, [assets]);

  const scanActiveTab = useCallback(async () => {
    setScanState('loading');
    setError('');
    setDownloadStatuses({});

    try {
      assertChromeApi();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        throw new Error('Open a website tab, then run Asset Crawler again.');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanCurrentPage,
      });

      const discovered = dedupeAssets(results.flatMap((result) => result.result ?? []));
      setAssets(discovered);
      setSelectedIds(new Set(discovered.map((asset) => asset.id)));
      setScanState('ready');
    } catch (scanError) {
      setAssets([]);
      setSelectedIds(new Set());
      setScanState('error');
      setError(scanError instanceof Error ? scanError.message : 'Unable to scan the active tab.');
    }
  }, []);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(STORAGE_FOLDER_KEY).then((result) => {
        const savedPath = result[STORAGE_FOLDER_KEY];
        if (typeof savedPath === 'string') {
          setFolderPath(savedPath);
        }
      });
    }

    void scanActiveTab();
  }, [scanActiveTab]);

  async function downloadSelected() {
    if (selectedAssets.length === 0 || !folderValidation.ok) {
      return;
    }

    setError('');
    const selectedStatus = Object.fromEntries(selectedAssets.map((asset) => [asset.id, 'queued' as DownloadStatus]));
    setDownloadStatuses((current) => ({ ...current, ...selectedStatus }));

    try {
      assertChromeApi();
      await chrome.storage.local.set({ [STORAGE_FOLDER_KEY]: folderValidation.value });

      const response = (await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ASSETS',
        assets: selectedAssets,
        folderPath: folderValidation.value,
      } satisfies DownloadAssetRequest)) as DownloadAssetResponse;

      const nextStatuses: Record<string, DownloadStatus> = {};
      response.results.forEach((result) => {
        nextStatuses[result.assetId] = result.error ? 'error' : 'complete';
      });
      setDownloadStatuses((current) => ({ ...current, ...nextStatuses }));

      if (!response.ok) {
        const firstError = response.results.find((result) => result.error)?.error;
        setError(firstError ?? 'Some downloads were rejected by Chrome.');
      }
    } catch (downloadError) {
      setDownloadStatuses((current) => ({
        ...current,
        ...Object.fromEntries(selectedAssets.map((asset) => [asset.id, 'error' as DownloadStatus])),
      }));
      setError(downloadError instanceof Error ? downloadError.message : 'Download request failed.');
    }
  }

  function toggleAsset(assetId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function toggleType(type: AssetType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredAssets.forEach((asset) => next.delete(asset.id));
      } else {
        filteredAssets.forEach((asset) => next.add(asset.id));
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={240}>
      <main className="min-h-[620px] bg-[#f7f7f4] text-zinc-900">
        <section className="border-b border-zinc-200/80 bg-[#fdfdfb] px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-700 shadow-[0_0_0_4px_rgba(4,120,87,0.1)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Asset Crawler</p>
              </div>
              <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-zinc-950">Download page media</h1>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={scanActiveTab} disabled={scanState === 'loading'} aria-label="Rescan active tab">
                  <ReloadIcon className={cn('size-4', scanState === 'loading' && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rescan active tab</TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <label className="relative block">
              <span className="sr-only">Search assets</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, extension, URL"
                className="pl-9"
              />
            </label>
            <Button variant="secondary" onClick={() => setQuery('')} disabled={!query} aria-label="Clear search">
              <Cross2Icon className="size-4" />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {ASSET_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={cn(
                  'min-h-9 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.08em] outline-none',
                  'transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-emerald-600/35',
                  activeTypes.has(type)
                    ? 'bg-emerald-800 text-white shadow-[0_4px_14px_rgba(4,120,87,0.18)]'
                    : 'bg-white text-zinc-600 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] hover:bg-zinc-50',
                )}
              >
                {type} <span className="tabular-nums text-[10px] opacity-70">{assetCounts[type]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 py-3">
          <div className="grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <label className="grid flex-1 gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  Downloads subfolder
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="size-3.5 text-zinc-400" />
                    </TooltipTrigger>
                    <TooltipContent>Relative to Chrome Downloads. Absolute paths are blocked by Chrome.</TooltipContent>
                  </Tooltip>
                </span>
                <Input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="website-assets" />
              </label>
              <Button
                variant="primary"
                onClick={downloadSelected}
                disabled={selectedAssets.length === 0 || !folderValidation.ok || scanState === 'loading'}
                className="mb-0"
              >
                <DownloadIcon className="size-4" />
                Download <span className="tabular-nums">{selectedAssets.length}</span>
              </Button>
            </div>

            {!folderValidation.ok ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-700">
                <ExclamationTriangleIcon className="size-3.5" />
                {folderValidation.error}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">Leave blank to save directly in Downloads.</p>
            )}
          </div>
        </section>

        <section className="mx-4 rounded-[18px] bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_18px_36px_-24px_rgba(0,0,0,0.28)]">
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-zinc-50 px-3">
            <button
              type="button"
              onClick={toggleAllFiltered}
              disabled={filteredAssets.length === 0}
              className="flex min-h-10 items-center gap-3 rounded-[8px] pr-2 text-left outline-none transition-[opacity,scale] duration-150 ease-out active:scale-[0.96] disabled:opacity-40"
            >
              <Checkbox checked={allFilteredSelected} aria-hidden="true" tabIndex={-1} />
              <span className="text-sm font-medium text-zinc-800">
                <span className="tabular-nums">{filteredAssets.length}</span> visible
              </span>
            </button>

            <div className="flex items-center gap-2">
              <Badge tone={selectedAssets.length ? 'active' : 'neutral'}>
                <span className="tabular-nums">{selectedAssets.length}</span> selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={selectedAssets.length === 0}>
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="mt-2 h-[318px] rounded-[10px]">
            {scanState === 'loading' ? <LoadingRows /> : null}
            {scanState === 'error' ? <ErrorState message={error} onRetry={scanActiveTab} /> : null}
            {scanState === 'ready' && assets.length === 0 ? <EmptyState onRetry={scanActiveTab} /> : null}
            {scanState === 'ready' && assets.length > 0 && filteredAssets.length === 0 ? (
              <EmptyState title="No matching assets" description="Change the search text or turn off type filters." onRetry={() => setActiveTypes(new Set())} actionLabel="Reset filters" />
            ) : null}
            {scanState === 'ready' && filteredAssets.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {filteredAssets.map((asset, index) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    index={index}
                    checked={selectedIds.has(asset.id)}
                    status={downloadStatuses[asset.id] ?? 'idle'}
                    onToggle={() => toggleAsset(asset.id)}
                  />
                ))}
              </div>
            ) : null}
          </ScrollArea>
        </section>

        {error && scanState !== 'error' ? (
          <div className="mx-4 mt-3 rounded-[12px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 shadow-[inset_0_0_0_1px_rgba(190,18,60,0.12)]">
            {error}
          </div>
        ) : null}
      </main>
    </TooltipProvider>
  );
}

function AssetRow({
  asset,
  checked,
  index,
  status,
  onToggle,
}: {
  asset: DiscoveredAsset;
  checked: boolean;
  index: number;
  status: DownloadStatus;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="asset-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 text-left outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-zinc-50 focus-visible:bg-emerald-50/50 active:scale-[0.995]"
      style={{ '--row-index': index } as React.CSSProperties}
    >
      <Checkbox checked={checked} aria-hidden="true" tabIndex={-1} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-zinc-900">{asset.fileName}</p>
          <Badge tone={asset.type === 'svg' || asset.type === 'icon' ? 'active' : 'neutral'}>{asset.extension}</Badge>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">{asset.tagName}</span>
          <span className="truncate">{asset.url ?? 'inline markup'}</span>
        </div>
      </div>
      <StatusBadge status={status} />
    </button>
  );
}

function StatusBadge({ status }: { status: DownloadStatus }) {
  if (status === 'complete') return <Badge tone="active">done</Badge>;
  if (status === 'error') return <Badge tone="error">error</Badge>;
  if (status === 'queued' || status === 'downloading') return <Badge tone="warning">queued</Badge>;
  return <Badge tone="neutral">idle</Badge>;
}

function LoadingRows() {
  return (
    <div className="grid gap-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[20px_1fr_52px] items-center gap-3">
          <div className="skeleton size-5 rounded-[6px]" />
          <div className="grid gap-2">
            <div className="skeleton h-4 w-3/4 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
          </div>
          <div className="skeleton h-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title = 'No assets found',
  description = 'This page does not expose downloadable media through standard DOM tags.',
  actionLabel = 'Scan again',
  onRetry,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-[260px] place-items-center px-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] bg-zinc-100 text-zinc-500">
          <MagnifyingGlassIcon className="size-5" />
        </div>
        <h2 className="text-balance text-base font-semibold text-zinc-950">{title}</h2>
        <p className="mt-1 text-pretty text-sm leading-6 text-zinc-500">{description}</p>
        <Button className="mt-4" onClick={onRetry}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] bg-rose-50 text-rose-700">
          <ExclamationTriangleIcon className="size-5" />
        </div>
        <h2 className="text-balance text-base font-semibold text-zinc-950">Scan blocked</h2>
        <p className="mt-1 text-pretty text-sm leading-6 text-zinc-500">{message}</p>
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function assertChromeApi() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting || !chrome.runtime) {
    throw new Error('This interface must run inside the Chrome extension popup.');
  }
}
