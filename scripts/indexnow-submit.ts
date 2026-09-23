/**
 * Tell Bing and Yandex which URLs changed, via IndexNow.
 *
 *   npx tsx scripts/indexnow-submit.ts            # URLs new or changed since the last run
 *   npx tsx scripts/indexnow-submit.ts --all      # every indexable URL
 *   npx tsx scripts/indexnow-submit.ts --dry      # show what would be sent
 *   npx tsx scripts/indexnow-submit.ts --url=https://pawlabs.org/tools
 *
 * Runs after a deploy. Google ignores IndexNow, so this does nothing for
 * Google — it is for Bing, Yandex, Seznam and the other participants, where it
 * genuinely shortens the wait from days to hours.
 *
 * What it will submit is deliberately constrained: the URL list comes from the
 * built sitemap, which by construction contains only pages we are willing to
 * have indexed. Anything carrying a noindex tag is excluded from the sitemap
 * upstream, so it cannot be submitted from here. As a second line of defence
 * the built HTML for every URL is checked for a noindex tag before sending,
 * because submitting a page we are asking search engines to drop is both
 * pointless and a bad signal.
 */

import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITEMAP_DIR = DIST;
const STATE_FILE = path.join(ROOT, '.indexnow-state.json');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const all = args.includes('--all');
const explicit = args.filter((a) => a.startsWith('--url=')).map((a) => a.slice('--url='.length));

interface Config {
  key: string;
  keyLocation: string;
  host: string;
}

function loadConfig(): Config {
  const file = path.join(ROOT, 'data/indexnow.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf-8')) as Config;
  if (!/^[0-9a-f]{32}$/.test(config.key)) throw new Error('indexnow key must be 32 hex characters');

  // The key file has to be deployed, or every submission is rejected.
  const keyFile = path.join(DIST, `${config.key}.txt`);
  if (!fs.existsSync(keyFile)) {
    throw new Error(`key file missing from the build: ${keyFile} — is public/${config.key}.txt committed?`);
  }
  if (fs.readFileSync(keyFile, 'utf-8').trim() !== config.key) {
    throw new Error('key file contents do not match the configured key');
  }
  return config;
}

/** Every <loc> in the built sitemap — that is, every URL we want indexed. */
function sitemapUrls(): string[] {
  const files = fs.readdirSync(SITEMAP_DIR).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  if (!files.length) throw new Error('no sitemap-N.xml in dist/ — run a build first');

  const urls = new Set<string>();
  for (const file of files) {
    const xml = fs.readFileSync(path.join(SITEMAP_DIR, file), 'utf-8');
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(match[1]);
  }
  return [...urls];
}

/** Map a URL back to the file the build produced, so we can inspect it. */
function builtFileFor(url: string): string | null {
  const pathname = new URL(url).pathname;
  const candidates = [
    path.join(DIST, pathname, 'index.html'),
    path.join(DIST, `${pathname}.html`),
    path.join(DIST, pathname),
  ];
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) ?? null;
}

/**
 * Refuse anything marked noindex. The sitemap should already exclude these;
 * this catches the case where the two disagree, which is exactly the bug that
 * would otherwise go unnoticed.
 */
function isIndexable(url: string): boolean {
  const file = builtFileFor(url);
  if (!file) return false;
  const html = fs.readFileSync(file, 'utf-8');
  const robots = html.match(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/i);
  return !robots || !/noindex/i.test(robots[1]);
}

/** Content hash per URL, so a re-run only submits what actually changed. */
function fingerprint(url: string): string | null {
  const file = builtFileFor(url);
  if (!file) return null;
  const stat = fs.statSync(file);
  return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
}

async function main() {
  const config = loadConfig();

  let candidates = explicit.length ? explicit : sitemapUrls();

  // Drop anything noindexed, loudly — a disagreement here is worth knowing about.
  const indexable: string[] = [];
  const refused: string[] = [];
  for (const url of candidates) {
    (isIndexable(url) ? indexable : refused).push(url);
  }
  if (refused.length) {
    console.warn(`[indexnow] refusing ${refused.length} URL(s) that are noindex or missing from the build:`);
    for (const url of refused.slice(0, 10)) console.warn(`           ${url}`);
  }

  const previous: Record<string, string> = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    : {};
  const current: Record<string, string> = {};
  for (const url of indexable) {
    const fp = fingerprint(url);
    if (fp) current[url] = fp;
  }

  let toSubmit = indexable;
  if (!all && !explicit.length && Object.keys(previous).length) {
    toSubmit = indexable.filter((url) => previous[url] !== current[url]);
  }

  console.log(
    `[indexnow] ${indexable.length} indexable URLs, ${toSubmit.length} new or changed since the last run`,
  );

  if (!toSubmit.length) {
    console.log('[indexnow] nothing to submit');
    return;
  }

  if (dry) {
    for (const url of toSubmit.slice(0, 40)) console.log(`           ${url}`);
    if (toSubmit.length > 40) console.log(`           ... and ${toSubmit.length - 40} more`);
    console.log('[indexnow] --dry, nothing sent');
    return;
  }

  // The API caps a submission at 10,000 URLs; batch well under it.
  const BATCH = 1000;
  let submitted = 0;
  for (let i = 0; i < toSubmit.length; i += BATCH) {
    const urlList = toSubmit.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: config.host,
        key: config.key,
        keyLocation: config.keyLocation,
        urlList,
      }),
      signal: AbortSignal.timeout(30000),
    });

    // 200 accepted, 202 accepted but key still being validated. Both are fine.
    if (res.status === 200 || res.status === 202) {
      submitted += urlList.length;
      console.log(`[indexnow] batch of ${urlList.length}: HTTP ${res.status}`);
    } else {
      const body = await res.text();
      console.error(`[indexnow] batch of ${urlList.length} rejected: HTTP ${res.status} ${body.slice(0, 200)}`);
      // Do not record state for a failed batch, so the next run retries it.
      process.exitCode = 1;
      return;
    }
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(current, null, 2));
  console.log(`[indexnow] submitted ${submitted} URL(s); state saved to ${path.basename(STATE_FILE)}`);
}

await main();
