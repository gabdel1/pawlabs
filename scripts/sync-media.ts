#!/usr/bin/env tsx
/**
 * Media Sync Script
 * 
 * Copies all media files from cms/media/ to public/media/ before Astro build.
 * Also checks the CMS API for any media not yet on local disk and downloads them.
 * This ensures images are served as static assets from the site itself,
 * eliminating runtime dependency on the CMS server for image delivery.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CMS_MEDIA_DIR = path.join(ROOT, 'cms', 'media');
const PUBLIC_MEDIA_DIR = path.join(ROOT, 'public', 'media');
const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';

/** Download a file from the CMS API */
async function downloadFromCms(filename: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(`${PAYLOAD_API_URL}/media/file/${encodeURIComponent(filename)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok || !res.body) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return false;
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

/** Get all media entries from the CMS API */
async function getCmsApiMedia(): Promise<{ filename: string }[]> {
  const results: { filename: string }[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    try {
      const res = await fetch(`${PAYLOAD_API_URL}/media?limit=100&page=${page}&depth=0`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const doc of data.docs ?? []) {
        if (doc.filename) results.push({ filename: doc.filename });
      }
      hasNext = data.hasNextPage ?? false;
      page++;
    } catch {
      break;
    }
  }
  return results;
}

async function syncMedia(): Promise<void> {
  // Ensure directories exist
  fs.mkdirSync(CMS_MEDIA_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true });

  // Step 1: Copy local cms/media/ → public/media/
  const localFiles = fs.existsSync(CMS_MEDIA_DIR)
    ? fs.readdirSync(CMS_MEDIA_DIR).filter((f) => fs.statSync(path.join(CMS_MEDIA_DIR, f)).isFile())
    : [];

  let copied = 0;
  let skipped = 0;

  for (const file of localFiles) {
    const src = path.join(CMS_MEDIA_DIR, file);
    const dest = path.join(PUBLIC_MEDIA_DIR, file);

    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
        skipped++;
        continue;
      }
    }

    fs.copyFileSync(src, dest);
    copied++;
  }

  console.log(`[sync-media] Local: ${copied} copied, ${skipped} up-to-date (${localFiles.length} files on disk)`);

  // Step 2: Check CMS API for files not on local disk and download them
  let downloaded = 0;
  try {
    const apiMedia = await getCmsApiMedia();
    for (const m of apiMedia) {
      const publicPath = path.join(PUBLIC_MEDIA_DIR, m.filename);
      const sourcePath = path.join(CMS_MEDIA_DIR, m.filename);
      if (!fs.existsSync(publicPath)) {
        const ok = await downloadFromCms(m.filename, publicPath);
        if (ok) {
          downloaded++;
          // Also cache in cms/media/ for future local syncs
          try { fs.copyFileSync(publicPath, sourcePath); } catch {}
        }
      }
    }
    if (downloaded > 0) {
      console.log(`[sync-media] API: ${downloaded} downloaded from CMS (${apiMedia.length} total in API)`);
    }
  } catch {
    console.log(`[sync-media] CMS API not reachable — skipping API sync (local files still synced)`);
  }
}

syncMedia();
