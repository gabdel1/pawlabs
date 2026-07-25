# PawLabs — Project Commands Reference

## Quick Start

```bash
# The CMS runs under systemd and should already be up — confirm, then build the site
systemctl is-active pawlabs-cms
npm run build

# If it isn't running
sudo systemctl start pawlabs-cms
```

---

## Astro (Static Site)

| Command | Description |
|---|---|
| `npm run dev` | Start the Astro dev server with hot-reload |
| `npm run build` | Build the static site to `dist/` (runs `prebuild` and `postbuild` hooks automatically) |
| `npm run preview` | Preview the production build locally |

### Build Hooks

The `build` command automatically runs these hooks in order:

1. **`prebuild`** → `tsx scripts/sync-media.ts` — Syncs all images from `cms/media/` to `public/media/`, and downloads any missing files from the CMS API.
2. **`build`** → `astro build` — Generates the static site into `dist/`.
3. **`postbuild`** → `tsx scripts/image-health-check.ts --check` — Validates all CMS-referenced images exist. Exits with code 1 if any are missing or corrupted.

---

## CMS (Payload + Next.js)

The CMS runs on port 3000 under **systemd**, as the `pawlabs-cms` service
(`/etc/systemd/system/pawlabs-cms.service`). The unit is enabled at boot and set to
`Restart=always`, so under normal conditions the CMS is always running and you do not
need to start it by hand.

systemd is the **only** supported way to manage the CMS process. Do not start
`next start` manually from a second shell — two managers racing for port 3000 is what
the old `scripts/cms.sh` supervisor did, and the loser would spin forever on
`EADDRINUSE` while the winner quietly kept serving a stale build.

| Command | Description |
|---|---|
| `systemctl status pawlabs-cms` | Check whether the CMS is running, plus recent log lines |
| `sudo systemctl restart pawlabs-cms` | Restart the CMS (**does not rebuild** — see below) |
| `sudo systemctl stop pawlabs-cms` | Stop the CMS |
| `sudo systemctl start pawlabs-cms` | Start the CMS |
| `journalctl -u pawlabs-cms -f` | Tail the CMS logs live |
| `journalctl -u pawlabs-cms --since "1 hour ago"` | Recent CMS logs |
| `curl -sf http://127.0.0.1:3000/api/media?limit=1` | Health check — exits non-zero if the API is not serving |

### Deploying CMS changes (build, then restart)

**The systemd unit does not build.** `ExecStart` is only `next start`, which serves
whatever is already in `cms/.next/`. Restarting after editing files under `cms/src/`
will happily keep serving the previous build — you must build first:

```bash
cd /srv/pet/cms

# 1. Regenerate the Payload import map (required after adding/changing collections
#    or admin components — a stale import map breaks the admin panel).
npx cross-env NODE_OPTIONS="--no-deprecation" payload generate:importmap

# 2. Clear webpack's persistent cache. If left in place, webpack may skip emitting
#    chunks it thinks are unchanged, leaving the new build's HTML referencing chunk
#    filenames that don't exist on disk — which shows up as ChunkLoadError in /admin.
rm -rf node_modules/.cache

# 3. Build.
npx cross-env NODE_OPTIONS="--max-old-space-size=4096" next build

# 4. Swap the running server onto the new build.
sudo systemctl restart pawlabs-cms
```

If a previous build was interrupted or is otherwise suspect, `rm -rf /srv/pet/cms/.next`
before step 3 to force a fully clean build.

The build step is deliberately kept out of the systemd unit: with `Restart=always` and
`RestartSec=5`, an `ExecStartPre` build would turn any startup crash into a rebuild loop.

### CMS Direct Commands (from `cms/` directory)

> **Port conflict warning:** the commands below that start a server (`dev`, `devsafe`,
> `start`) bind port 3000, which the `pawlabs-cms` service is already holding. On the
> server, `sudo systemctl stop pawlabs-cms` first, or they will die with `EADDRINUSE`.

| Command | Description |
|---|---|
| `cd cms && npm run dev` | Start CMS in development mode with hot-reload |
| `cd cms && npm run devsafe` | Clean `.next` cache and start dev mode (fixes corrupt builds) |
| `cd cms && npm run build` | Production build of the CMS |
| `cd cms && npm run start` | Start the CMS in production mode (foreground) |
| `cd cms && npm run generate:types` | Regenerate TypeScript types from Payload collections |
| `cd cms && npm run generate:importmap` | Regenerate Payload import map |
| `cd cms && npm run payload` | Run arbitrary Payload CLI commands |

### CMS Admin Panel

Once the CMS is running, access the admin panel at: **http://localhost:3000/admin**

---

## Media Management

Images flow from CMS → `cms/media/` → `public/media/` → `dist/media/`. The static site serves images from `public/media/` with no runtime CMS dependency.

| Command | Description |
|---|---|
| `npm run media:sync` | One-shot sync: copies `cms/media/` → `public/media/`, downloads missing files from CMS API |
| `npm run media:check` | Audit all images — reports missing, corrupted, or mismatched files (no changes) |
| `npm run media:repair` | Audit + auto-fix: copies missing files from source or downloads from CMS API |
| `npm run media:watch` | Start the image supervisor daemon (background process, auto-repairs on interval) |
| `npm run media:stop` | Stop the image supervisor daemon |

### Image Supervisor Daemon

The daemon polls for missing or corrupted images and automatically repairs them.

```bash
# Start with default 60-second interval
npm run media:watch

# Start with custom interval (via script directly)
npx tsx scripts/image-health-check.ts --daemon --interval 30

# Check daemon status
cat .image-supervisor.pid 2>/dev/null && echo "Running" || echo "Not running"

# View daemon logs
tail -f .image-supervisor.log

# Stop the daemon
npm run media:stop
```

### Repair Logic

When repairing, the system tries these sources in order:
1. **Local copy** from `cms/media/` (fastest)
2. **CMS API download** from `http://localhost:3000/api/media/file/<filename>` (fallback for files not yet on disk)

Downloaded files are cached in `cms/media/` so future syncs don't need the API.

---

## AI Review Generator

Generate product reviews from affiliate links using Grok AI (xAI).

```bash
# Generate a review (dry-run, prints to console)
npx tsx scripts/generate-review.ts "https://amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20"

# Generate with extra context for better results
npx tsx scripts/generate-review.ts "https://amazon.com/dp/B0BFH9XKGL" \
  --context "self-cleaning litter box for cats"

# Generate and save directly to CMS
npx tsx scripts/generate-review.ts "https://amazon.com/dp/B0BFH9XKGL" --save
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `XAI_API_KEY` | xAI API key for Grok model access |
| `CMS_EMAIL` | Payload CMS admin email (required for `--save`) |
| `CMS_PASSWORD` | Payload CMS admin password (required for `--save`) |

---

## Data Recovery

Restore products, media, and guides from cached recovery files.

```bash
# Restore from .cache/recovered_*.json files
npx tsx scripts/restore-data.ts
```

This script:
- Authenticates with the CMS (creates admin user if needed)
- Uploads media files from `cms/media/` as FormData
- Restores products and guides with correct media ID mappings
- Preserves gallery image associations

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PAYLOAD_API_URL` | `http://127.0.0.1:3000/api` | CMS API base URL |
| `CMS_PORT` | `3000` | Port for the CMS server |
| `XAI_API_KEY` | — | xAI API key for review generation |
| `CMS_EMAIL` | — | CMS admin email |
| `CMS_PASSWORD` | — | CMS admin password |
| `DATABASE_URI` | `postgresql://localhost:5432/pawlabs` | PostgreSQL connection string |

---

## Project Structure

```
/srv/pet/
├── src/                    # Astro static site source
│   ├── pages/              # Route pages (index, products, breeds, guides, compare)
│   ├── components/         # Shared components (Nav, Logo, Breadcrumbs, etc.)
│   ├── layouts/            # Layout wrapper (SEO, meta tags, analytics)
│   ├── lib/                # API client (payload.ts), SEO helpers
│   └── styles/             # Global CSS
├── cms/                    # Payload CMS (Next.js)
│   ├── src/collections/    # CMS collection schemas (Products, Breeds, Guides, etc.)
│   ├── src/payload.config.ts
│   └── media/              # CMS-uploaded media files (source of truth)
├── public/media/           # Static media copies (served by the site)
├── scripts/
│   ├── sync-media.ts       # Media sync (prebuild hook)
│   ├── image-health-check.ts # Image audit, repair, and daemon
│   ├── generate-review.ts  # AI review generator CLI
│   ├── grok-review.ts      # Grok AI integration library
│   └── restore-data.ts     # Database recovery script
├── dist/                   # Built static site output
└── .cache/payload/         # API response cache (build fallback)
```

---

## Common Workflows

### Add a new product

```bash
# Option 1: Via CMS admin panel
systemctl is-active pawlabs-cms
# Then open http://localhost:3000/admin and add the product

# Option 2: Via AI generator
npx tsx scripts/generate-review.ts "https://amazon.com/dp/PRODUCT_ID" --save
npm run build
```

### Full rebuild after CMS changes

```bash
# If the change touched cms/src/, rebuild and restart the CMS first
# (see "Deploying CMS changes" above), then:
systemctl is-active pawlabs-cms   # Make sure CMS is running
npm run build                     # Syncs media + builds site + validates images
```

### Debug missing images

```bash
npm run media:check  # See which images are missing or corrupted
npm run media:repair # Auto-fix by copying from source or downloading from CMS API
```
