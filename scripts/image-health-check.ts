#!/usr/bin/env tsx
/**
 * Image Health Supervisor
 * 
 * A monitoring service that ensures all CMS-referenced images exist and are
 * correctly synced to the static site's public/media/ directory.
 *
 * Modes:
 *   --check    One-shot audit: report missing/broken images, exit with code 1 if any found
 *   --watch    Continuous supervisor: poll every INTERVAL seconds, auto-repair missing images
 *   --repair   One-shot: detect and fix all missing images, then exit
 * 
 * Usage:
 *   npx tsx scripts/image-health-check.ts --check
 *   npx tsx scripts/image-health-check.ts --repair
 *   npx tsx scripts/image-health-check.ts --watch --interval 60
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CMS_MEDIA_DIR = path.join(ROOT, 'cms', 'media');
const PUBLIC_MEDIA_DIR = path.join(ROOT, 'public', 'media');
const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';

interface HealthReport {
  timestamp: string;
  totalMedia: number;
  healthy: number;
  missing: number;
  corrupted: number;
  repaired: number;
  issues: Issue[];
  warnings: string[];
}

interface Issue {
  filename: string;
  type: 'missing_public' | 'missing_source' | 'size_mismatch' | 'zero_bytes' | 'api_unreachable';
  detail: string;
  repaired: boolean;
}

/** Check if the CMS API is reachable */
async function checkCmsApi(): Promise<boolean> {
  try {
    const res = await fetch(`${PAYLOAD_API_URL}/media?limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Download a media file from the CMS API to a local path */
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

/** Get all media filenames referenced in the CMS */
async function getCmsMediaList(): Promise<{ filename: string; filesize: number }[]> {
  const results: { filename: string; filesize: number }[] = [];
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
        if (doc.filename) {
          results.push({ filename: doc.filename, filesize: doc.filesize ?? 0 });
        }
      }
      hasNext = data.hasNextPage ?? false;
      page++;
    } catch {
      break;
    }
  }

  return results;
}

/** Audit everything and return a health report */
async function audit(autoRepair: boolean): Promise<HealthReport> {
  const issues: Issue[] = [];
  const warnings: string[] = [];
  let repaired = 0;

  // Ensure directories exist
  fs.mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true });

  // Check CMS API (advisory only — images are served statically)
  const apiUp = await checkCmsApi();
  if (!apiUp) {
    warnings.push(`CMS API at ${PAYLOAD_API_URL} is not reachable (images still served statically)`);
  }

  // Get files from CMS media dir (source of truth on disk)
  const sourceFiles = new Map<string, number>();
  if (fs.existsSync(CMS_MEDIA_DIR)) {
    for (const f of fs.readdirSync(CMS_MEDIA_DIR)) {
      const fp = path.join(CMS_MEDIA_DIR, f);
      const stat = fs.statSync(fp);
      if (stat.isFile()) {
        sourceFiles.set(f, stat.size);
      }
    }
  }

  // Also check CMS API for files that might not be on disk
  let apiMedia: { filename: string; filesize: number }[] = [];
  if (apiUp) {
    apiMedia = await getCmsMediaList();
    for (const m of apiMedia) {
      if (!sourceFiles.has(m.filename)) {
        sourceFiles.set(m.filename, m.filesize);
      }
    }
  }

  const totalMedia = sourceFiles.size;
  let healthy = 0;
  let missing = 0;
  let corrupted = 0;

  for (const [filename, expectedSize] of sourceFiles) {
    const publicPath = path.join(PUBLIC_MEDIA_DIR, filename);
    const sourcePath = path.join(CMS_MEDIA_DIR, filename);

    // Check if file exists in public/media/
    if (!fs.existsSync(publicPath)) {
      missing++;
      const issue: Issue = {
        filename,
        type: 'missing_public',
        detail: `Missing from public/media/`,
        repaired: false,
      };

      // Try to repair by copying from source, or downloading from CMS API
      if (autoRepair) {
        let fixed = false;
        if (fs.existsSync(sourcePath)) {
          try {
            fs.copyFileSync(sourcePath, publicPath);
            fixed = true;
          } catch (err) {
            issue.detail += ` — copy failed: ${err}`;
          }
        } else if (apiUp) {
          // Source file not on disk — download from CMS API
          fixed = await downloadFromCms(filename, publicPath);
          if (fixed) {
            // Also save to cms/media/ so future syncs don't need the API
            try { fs.copyFileSync(publicPath, sourcePath); } catch {}
          } else {
            issue.detail += ` — API download failed`;
          }
        }
        if (fixed) {
          issue.repaired = true;
          repaired++;
          missing--;
          healthy++;
        }
      }
      issues.push(issue);
      continue;
    }

    // Check for zero-byte files (corrupted)
    const publicStat = fs.statSync(publicPath);
    if (publicStat.size === 0) {
      corrupted++;
      const issue: Issue = {
        filename,
        type: 'zero_bytes',
        detail: `File is 0 bytes in public/media/`,
        repaired: false,
      };

      if (autoRepair) {
        let fixed = false;
        if (fs.existsSync(sourcePath)) {
          const srcStat = fs.statSync(sourcePath);
          if (srcStat.size > 0) {
            try {
              fs.copyFileSync(sourcePath, publicPath);
              fixed = true;
            } catch (err) {
              issue.detail += ` — copy failed: ${err}`;
            }
          }
        }
        if (!fixed && apiUp) {
          fixed = await downloadFromCms(filename, publicPath);
          if (fixed) {
            try { fs.copyFileSync(publicPath, sourcePath); } catch {}
          } else {
            issue.detail += ` — API download failed`;
          }
        }
        if (fixed) {
          issue.repaired = true;
          repaired++;
          corrupted--;
          healthy++;
        }
      }
      issues.push(issue);
      continue;
    }

    // Check size mismatch with source
    if (fs.existsSync(sourcePath)) {
      const srcStat = fs.statSync(sourcePath);
      if (publicStat.size !== srcStat.size) {
        corrupted++;
        const issue: Issue = {
          filename,
          type: 'size_mismatch',
          detail: `Size mismatch: public=${publicStat.size}, source=${srcStat.size}`,
          repaired: false,
        };

        if (autoRepair) {
          try {
            fs.copyFileSync(sourcePath, publicPath);
            issue.repaired = true;
            repaired++;
            corrupted--;
            healthy++;
          } catch (err) {
            issue.detail += ` — repair failed: ${err}`;
          }
        }
        issues.push(issue);
        continue;
      }
    }

    healthy++;
  }

  return {
    timestamp: new Date().toISOString(),
    totalMedia,
    healthy,
    missing,
    corrupted,
    repaired,
    issues,
    warnings,
  };
}

function printReport(report: HealthReport): void {
  const status = report.missing === 0 && report.corrupted === 0 ? '✅ HEALTHY' : '❌ ISSUES FOUND';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Image Health Report — ${status}`);
  console.log(`  ${report.timestamp}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total media:  ${report.totalMedia}`);
  console.log(`  Healthy:      ${report.healthy}`);
  console.log(`  Missing:      ${report.missing}`);
  console.log(`  Corrupted:    ${report.corrupted}`);
  if (report.repaired > 0) {
    console.log(`  Repaired:     ${report.repaired}`);
  }
  console.log(`${'='.repeat(60)}`);

  if (report.warnings.length > 0) {
    console.log('\n  Warnings (non-critical):');
    for (const w of report.warnings) {
      console.log(`    ⚠ ${w}`);
    }
  }

  if (report.issues.length > 0) {
    console.log('\n  Issues:');
    for (const issue of report.issues) {
      const status = issue.repaired ? ' [REPAIRED]' : '';
      console.log(`    - ${issue.filename}: ${issue.detail}${status}`);
    }
    console.log('');
  }
}

const PID_FILE = path.join(ROOT, '.image-supervisor.pid');
const LOG_FILE = path.join(ROOT, '.image-supervisor.log');

/** Run the watcher loop */
async function watchLoop(intervalSec: number): Promise<void> {
  // Write PID file so the process can be managed
  fs.writeFileSync(PID_FILE, String(process.pid));
  process.on('exit', () => {
    try { fs.unlinkSync(PID_FILE); } catch {}
  });
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  console.log(`[image-supervisor] Running (PID ${process.pid}, interval: ${intervalSec}s)`);

  const run = async () => {
    const report = await audit(true); // auto-repair in watch mode
    if (report.issues.length > 0) {
      printReport(report);
    } else {
      const ts = new Date().toISOString();
      console.log(`[image-supervisor] ${ts} — All ${report.totalMedia} images healthy`);
    }
  };

  // Initial run
  await run();

  // Continuous polling
  setInterval(run, intervalSec * 1000);
}

// ── CLI ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const hasWatch = args.includes('--watch');
const hasDaemon = args.includes('--daemon');
const mode = hasWatch ? 'watch' : hasDaemon ? 'daemon' : args.includes('--repair') ? 'repair' : args.includes('--stop') ? 'stop' : 'check';
const intervalIdx = args.indexOf('--interval');
const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1], 10) || 60 : 60;

(async () => {
  switch (mode) {
    case 'watch':
      await watchLoop(interval);
      break;

    case 'daemon': {
      const scriptPath = fileURLToPath(import.meta.url);
      // Kill existing daemon if running
      if (fs.existsSync(PID_FILE)) {
        const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        try { process.kill(oldPid, 0); process.kill(oldPid, 'SIGTERM'); console.log(`[image-supervisor] Stopped old daemon (PID ${oldPid})`); } catch {}
        try { fs.unlinkSync(PID_FILE); } catch {}
      }
      const logFd = fs.openSync(LOG_FILE, 'a');
      const child = spawn(process.argv[0], [...process.execArgv, scriptPath, '--watch', '--interval', String(interval)], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: process.env,
      });
      child.unref();
      fs.closeSync(logFd);
      console.log(`[image-supervisor] Daemon started (PID ${child.pid})`);
      console.log(`[image-supervisor] Logs: ${LOG_FILE}`);
      process.exit(0);
    }

    case 'stop': {
      if (fs.existsSync(PID_FILE)) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`[image-supervisor] Stopped daemon (PID ${pid})`);
        } catch {
          console.log(`[image-supervisor] Daemon not running (stale PID ${pid})`);
        }
        try { fs.unlinkSync(PID_FILE); } catch {}
      } else {
        console.log('[image-supervisor] No daemon running');
      }
      break;
    }

    case 'repair': {
      console.log('[image-supervisor] Running repair...');
      const report = await audit(true);
      printReport(report);
      process.exit(report.missing > 0 || report.corrupted > 0 ? 1 : 0);
      break;
    }

    case 'check':
    default: {
      const report = await audit(false);
      printReport(report);
      process.exit(report.missing > 0 || report.corrupted > 0 ? 1 : 0);
      break;
    }
  }
})();
