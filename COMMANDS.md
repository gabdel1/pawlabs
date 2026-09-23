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

## AI Content Generation

Breed profiles and comparisons are generated from custom admin views in the CMS
(not CLI scripts). Start the CMS, then open the admin panel:

| View | URL | Description |
|---|---|---|
| AI Breeds | `/admin/ai-breed` | Generate a full breed profile with 14 trait ratings |
| Breed Compare | `/admin/ai-breed-compare` | Generate a head-to-head comparison from 2+ breeds |
| AI Quiz Questions | `/admin/ai-quiz` | Draft Breed Match quiz questions from notes |

All save as **drafts** so you can review before publishing. Generation requires
`XAI_API_KEY` in `cms/.env`.

---

## Comparison Generation API

A machine-facing endpoint for writing head-to-head breed comparisons into the CMS without a
logged-in session. Use it to backfill `/compare` in bulk; use `/admin/ai-breed-compare` when
you want to eyeball a draft before saving.

```
POST https://pawlabs.org/api/generate/comparison
Content-Type: application/json
```

`GET` the same URL returns a summary of the parameters, so the endpoint documents itself.

### Authentication

A shared secret held in `GENERATE_API_KEY` in `cms/.env`. Three ways to present it — pick one:

```bash
# 1. In the JSON body
-d '{"key":"<secret>", "breeds":[...]}'

# 2. X-Api-Key header
-H 'X-Api-Key: <secret>'

# 3. Bearer token
-H 'Authorization: Bearer <secret>'
```

The comparison is timing-safe, and the endpoint **fails closed**: if `GENERATE_API_KEY` is
unset or blank it returns `503` for everyone rather than letting requests through.

**To rotate:** change the value in `cms/.env`, then `sudo systemctl restart pawlabs-cms`.
No rebuild needed — env vars are read at boot, not at build.

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes¹ | The shared secret. ¹Unless sent as a header instead. |
| `breeds` | string[] | **yes** | 2–5 breed **slugs** (`"golden-retriever"`) or numeric ids. Order is preserved. Duplicates are ignored. |
| `criteria` | string[] | no | Comparison table rows. Omit and the endpoint picks the five where these breeds differ most — usually what you want. |
| `context` | string | no | Free-text steer for the writer, e.g. `"focus on apartment dwellers"`. Max 600 chars. |
| `status` | string | no | `"draft"` (default) or `"published"`. |
| `dryRun` | boolean | no | `true` generates and returns the article **without saving**. Still costs an AI call. |
| `guide` | object | no | An article you already previewed — `{title, content, slug?, summary?, verdict?}`. Saved as-is with **no AI call**, and does not consume the rate limit. This is the API equivalent of the admin panel's Generate-then-Save. |

### Preview, then save the same article

`dryRun` gives you the article without writing it. To keep that exact one, send it back under
`guide` — the endpoint skips generation entirely and just persists it:

```bash
curl -s -X POST https://pawlabs.org/api/generate/comparison -H 'Content-Type: application/json' -d "{\"key\":\"$GENERATE_API_KEY\",\"breeds\":[\"beagle\",\"dachshund\"],\"dryRun\":true}" -o preview.json
```

Then edit `preview.json` if you want, and save it:

```bash
python3 -c "import json;d=json.load(open('preview.json'));json.dump({'key':'$GENERATE_API_KEY','breeds':['beagle','dachshund'],'criteria':d['criteria'],'guide':d['guide'],'status':'draft'},open('save.json','w'))" && curl -s -X POST https://pawlabs.org/api/generate/comparison -H 'Content-Type: application/json' --data-binary @save.json
```

The response includes `"generated": false` so you can tell a save from a generation.

### Valid criteria

`lowShedding` · `apartmentFriendly` · `watchdogAbility` · `energyLevel` · `trainability` ·
`childFriendly` · `petFriendly` · `easyGrooming` · `barkingControl` · `adaptability` ·
`intelligence` · `healthRobustness`

Four are inverted from the underlying trait so that **higher always means better** in the
table: `lowShedding`, `easyGrooming` and `barkingControl` are `11 − trait`, and
`apartmentFriendly` is the mean of adaptability, inverted energy and inverted barking.

### Examples

Minimal — let it choose the criteria:

```bash
curl -X POST https://pawlabs.org/api/generate/comparison -H 'Content-Type: application/json' -d '{"key":"'"$GENERATE_API_KEY"'","breeds":["whippet","french-bulldog"]}'
```

Full control, published immediately:

```bash
curl -X POST https://pawlabs.org/api/generate/comparison -H 'Content-Type: application/json' -d '{"key":"'"$GENERATE_API_KEY"'","breeds":["golden-retriever","labrador-retriever"],"criteria":["childFriendly","energyLevel","trainability","lowShedding"],"context":"focus on families with toddlers","status":"published"}'
```

Preview without writing to the CMS:

```bash
curl -X POST https://pawlabs.org/api/generate/comparison -H "X-Api-Key: $GENERATE_API_KEY" -H 'Content-Type: application/json' -d '{"breeds":["german-shepherd-dog","belgian-malinois"],"dryRun":true}'
```

Backfill a batch — one pair per line, sequential so you stay under the rate limit:

```bash
export GENERATE_API_KEY=$(grep '^GENERATE_API_KEY=' /srv/pet/cms/.env | cut -d= -f2)
while read -r a b; do
  echo "→ $a vs $b"
  curl -s -X POST https://pawlabs.org/api/generate/comparison -H 'Content-Type: application/json' -d "{\"key\":\"$GENERATE_API_KEY\",\"breeds\":[\"$a\",\"$b\"]}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("  ", d.get("comparison",{}).get("title") or d.get("error"))'
  sleep 2
done <<'PAIRS'
golden-retriever labrador-retriever
german-shepherd-dog belgian-malinois
french-bulldog pug
border-collie australian-shepherd
PAIRS
```

### Success response

```json
{
  "ok": true,
  "saved": true,
  "breeds": [{ "id": "87", "name": "Whippet", "slug": "whippet" }],
  "criteria": ["energyLevel", "healthRobustness", "lowShedding"],
  "criteriaSource": "derived",
  "elapsedSeconds": 20.1,
  "comparison": {
    "id": 1,
    "title": "Whippet vs French Bulldog: Which Is Right for You?",
    "slug": "whippet-vs-french-bulldog-comparison",
    "status": "draft",
    "adminUrl": "/admin/collections/comparisons/1",
    "liveUrl": null
  },
  "note": "Saved as a draft. Review it, set status to published, then run `npm run build`."
}
```

`criteriaSource` is `"requested"` or `"derived"` so a batch job can log which it got.
With `dryRun: true` there is no `comparison` key — the article comes back under `guide`.

### Errors

| Status | Meaning |
|---|---|
| `400` | Fewer than 2 or more than 5 breeds, unknown criteria, or malformed JSON |
| `401` | Missing or wrong key |
| `404` | A breed slug or id did not match anything |
| `429` | Rate limit — 30 calls/hour per IP |
| `503` | `GENERATE_API_KEY` not configured on the server |
| `500` | Generation failed (usually xAI erroring or `XAI_API_KEY` missing) |

### Operational notes

- **A call takes 20–60 seconds.** Set your client timeout to at least 120s; curl's default is fine, but most HTTP libraries will give up too early.
- **Every call costs an xAI request**, including `dryRun`. The 30/hour cap is there to stop a loop with a bug in it running up a bill.
- **Slug collisions are handled** — a clashing slug gets `-2`, `-3` appended rather than failing.
- **Drafts do not appear on the site.** Nothing is public until `status` is `published` *and* you rebuild:

```bash
cd /srv/pet && npm run build
```

---

## Comparison Automation

Two comparison articles a week, published and live without anyone touching it.

`pawlabs-daily-comparison.timer` fires **Tuesday and Saturday at 04:17** (plus up to
10 minutes of jitter), runs `scripts/daily-comparison.sh`, which asks the CMS for the
best remaining subject, writes and publishes the article, then rebuilds the static site.
The unit keeps its original name; only the schedule changed.

### What it will and will not write

An ads review in September 2026 found the output read as machine-generated: six
near-identical "X vs Y vs Airedale Terrier" articles, and a tail of pairings between
breeds nobody searches for. Three guards now exist, and they are the reason the queue
is much shorter than it used to be:

| Guard | Where | Effect |
|---|---|---|
| Demand floor | `cms/src/lib/search-demand.ts` | Both breeds in a pairing must score 45+ in `data/search-demand.json`. Roundups are judged on their lifestyle angle instead. |
| Filler cap | `MAX_PAIRING_APPEARANCES` in `cms/src/lib/content-planner.ts` | No breed may appear in more than **2** pairing articles, which is what stopped one dog being bolted onto six of them. |
| Structure variation | `cms/src/lib/comparison-shapes.ts` | Each article gets one of six genuinely different plans and its own headings. The old shared skeleton is a banned-phrase list. |

`data/search-demand.json` currently holds a **seed** list, not measured data. Replace it
with the real thing whenever Search Console has enough history:

```bash
# export Search Console queries to CSV, then
cd /srv/pet/cms && npx tsx src/scripts/import-search-demand.ts ~/queries.csv
```

### Retired articles

`data/retired-comparisons.json` lists articles withdrawn as combinatorial or
negligible-demand. They are **not deleted** — the CMS documents remain published, the
site simply stops building a page, and nginx 301s each URL to the ranking covering the
same breeds. To change the list, edit that file and then:

```bash
npx tsx scripts/generate-comparison-redirects.ts
sudo cp deploy/nginx-comparison-redirects.conf \
  /etc/nginx/conf.d/zz-pawlabs-comparison-redirects.conf
sudo nginx -t && sudo systemctl reload nginx
npm run build
```

The `zz-` prefix matters: conf.d loads alphabetically and the media redirects file must
set `map_hash_bucket_size` first, since nginx rejects a duplicate declaration.

| Command | Description |
|---|---|
| `systemctl list-timers pawlabs-daily-comparison` | When it next runs, when it last ran |
| `sudo systemctl start pawlabs-daily-comparison.service` | Run it now, exactly as the timer would |
| `journalctl -u pawlabs-daily-comparison -n 50 --no-pager` | What happened on recent runs |
| `tail -f /srv/pet/.daily-comparison.log` | The script's own log |
| `sudo systemctl disable --now pawlabs-daily-comparison.timer` | Turn the whole thing off |
| `./scripts/daily-comparison.sh` | Run by hand, same behaviour |

Set `COMPARISON_STATUS=draft` to have it stage articles for review instead of publishing:

```bash
sudo systemctl edit pawlabs-daily-comparison.service   # add: Environment=COMPARISON_STATUS=draft
```

### The content plan

The daily job works through a **year-long editorial calendar** stored in the
`content-plan` collection (`/admin/collections/content-plan`), not just 1v1 pairings.
Curate it like any other content: delete ideas you dislike, change a scheduled date to
reorder, or add your own rows by hand.

Four article styles are drawn from a weighted pool:

| Style | Draw weight | Shape |
|---|---|---|
| `best-for` | 40 | Ranked roundup answering a lifestyle question — "Best dogs for apartment living" |
| `head-to-head` | 30 | Two breeds, the classic comparison |
| `three-way` | 15 | Three breeds cross-shopped as a set |
| `group-roundup` | 15 | Every breed in one group, ranked |

Roundup subjects come from ~25 lifestyle **angles** (apartments, first-time owners,
allergy sufferers, runners, shift workers, therapy work…) defined in
`cms/src/lib/content-styles.ts`. Each angle carries **trait targets**, so the shortlist is
objective: "best apartment dogs" returns breeds that actually score low on energy and
barking and high on adaptability, not just small ones.

Angles are also crossed with breed groups — "Best terrier breeds for apartment living" —
which turns 25 subjects into a couple of hundred and keeps a year from collapsing into
nothing but head-to-heads. A typical 365-day plan comes out around **187 roundups, 114
head-to-heads, 57 three-ways, 7 group roundups**.

Build or top up the plan:

```bash
curl -s -X POST http://127.0.0.1:3000/api/generate/plan -H "X-Api-Key: $GENERATE_API_KEY" -H 'Content-Type: application/json' -d '{"days":365}' | python3 -m json.tool
```

| Field | Default | Description |
|---|---|---|
| `days` | 365 | Slots to plan, max 730 |
| `seed` | fixed | Same seed + same data = same plan |
| `dryRun` | false | Return the plan without saving |
| `replace` | false | Delete existing **queued** items first |

Re-running without `replace` continues the calendar from where it currently ends and
skips anything already planned or written, so it is safe to run repeatedly as a top-up.

Roundup breeds are deliberately **not** fixed at plan time — only the angle is stored, and
the shortlist is scored when the article is written, so picks reflect the latest ratings
rather than whatever was true a year earlier.

### How the pair is chosen

`cms/src/lib/comparison-pairs.ts` scores every pair that has **not** been written yet.
Two random breeds would produce articles nobody searches for — "Chihuahua vs Great Dane"
is not a decision anyone is weighing. So the score rewards pairs someone would genuinely
cross-shop:

| Signal | Weight |
|---|---|
| Shared family word in both names (*terrier*, *retriever*, *hound*…) | **+6** |
| Same breed group | +3 |
| Same size band | +2 (adjacent +1, two bands apart **−4**) |
| Overlapping weight ranges | +2 |
| Each trait they differ on by 3+ points | +1 each |
| Each breed marked Featured | +2 |
| Each comparison a breed already appears in | **−2** (spreads coverage) |

Pairs already compared are excluded outright, as are cross-species pairs. The table
criteria are then chosen from the five traits where that specific pair diverges most, so
no row is a tie.

Preview the decision without spending an AI call:

```bash
curl -s -X POST http://127.0.0.1:3000/api/generate/comparison/daily -H "X-Api-Key: $GENERATE_API_KEY" -H 'Content-Type: application/json' -d '{"dryRun":true}' | python3 -m json.tool
```

That returns the chosen pair, its score, a plain-English reason, and the four runners-up.

### Endpoint

`POST /api/generate/comparison/daily` — same shared secret as the manual endpoint.

| Field | Default | Description |
|---|---|---|
| `dryRun` | `false` | Show the pick, generate nothing |
| `status` | `"published"` | `"draft"` to stage for review |

It takes the oldest queued plan item due on or before today, dispatches it to the right
writer for its style, publishes, and links the article back to the plan row. If nothing is
due it takes the earliest queued item anyway, so the timer never has a silent no-op day.
With an empty plan it falls back to picking the best remaining pair on the fly.

A plan item that fails is marked `failed` with the error recorded, so one bad row cannot
block the queue forever. Returns `409` only when the plan is empty *and* every viable pair
has been compared — the script treats that as success, not a failure.

### Why the build is staged

`astro build` empties its output directory before writing. Building straight into `dist/`
means a failure at 4am leaves the live site as a pile of missing files until someone
notices. The script builds into `dist-next/`, sanity-checks that `index.html` and
`sitemap-index.xml` exist, and only then swaps directories. **A failed build leaves the
live site untouched.**

Exit codes: `0` ok · `1` generation failed · `2` build failed · `3` preconditions bad.

---

## Breed Match Quiz

The quiz lives at `/quiz`. Questions come from the `quiz-questions` collection and are
baked into the static build; only the final match calls the CMS at runtime.

| Command | Description |
|---|---|
| `cd cms && npx tsx src/scripts/seed-quiz-questions.ts` | Seed the baseline questions (skips keys that already exist) |
| `cd cms && npx tsx src/scripts/seed-quiz-questions.ts --force` | Overwrite existing questions with the seed definitions |

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/quiz/match` | Public | Scores breeds against the answers, asks Grok to pick three, stores the submission, subscribes the email. Rate limited to 12/hour per IP. |
| `POST /api/ai/quiz-question` | Admin | `action: notes` reads recent visitor notes, `preview` drafts questions, `save` stores them as drafts. |

**After editing questions in the CMS, rebuild the site** — questions are static:

```bash
npm run build
```

Test the match endpoint directly:

```bash
curl -s -X POST http://127.0.0.1:3000/api/quiz/match -H 'Content-Type: application/json' -d '{"petType":"dog","answers":[{"key":"home-setup","value":"apartment"},{"key":"activity-level","value":"daily-walk"}]}'
```

> Each match costs a Grok call (~20s). If `XAI_API_KEY` is missing or xAI errors, the
> endpoint falls back to pure trait scoring and flags the result `matchedBy: "fallback"`.

---

## Database Migrations

Schema changes are managed through Payload migrations in `cms/src/migrations/`.

```bash
# Apply pending migrations
cd cms && npx payload migrate

# Check migration status
cd cms && npx payload migrate:status

# Roll back the most recent migration
cd cms && npx payload migrate:down
```

> `payload migrate:create` prompts interactively for enum renames — run it in a real
> terminal, or hand-write the migration and register it in `src/migrations/index.ts`.

### Why `migrate:create` asks about enums that no longer exist

Drizzle diffs against the `.json` snapshot beside the newest migration, not against the
live database. The two most recent migrations were hand-written and have no snapshot, so
the diff still starts from `20260330_192620.json` — which contains the long-deleted
products/guides/reviews tables. That is why it offers to "rename" enums that were dropped
months ago.

To hand-write a migration with DDL guaranteed to match what Drizzle expects at runtime,
let Drizzle generate the schema in a scratch database and read it back:

```bash
# 1. Empty scratch DB (needs superuser; the pawlabs role cannot CREATE DATABASE)
sudo -u postgres psql -c "CREATE DATABASE pawlabs_scratch OWNER pawlabs;"

# 2. Boot Payload against it with NODE_ENV unset so the adapter pushes the schema,
#    then dump it and copy out the statements for your new tables.
sudo -u postgres pg_dump -d pawlabs_scratch --schema-only --no-owner --no-privileges

# 3. Verify: restore the real schema into a second scratch DB, apply your migration,
#    and diff the result against the pushed schema. They should be identical.

# 4. Clean up
sudo -u postgres psql -c "DROP DATABASE pawlabs_scratch;"
```

> Any `npx tsx` script that boots Payload will **push the schema** unless `NODE_ENV` is
> set to `production` — against `pawlabs` that means silent live schema edits. The seed
> scripts set it defensively; do the same in anything new.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PAYLOAD_API_URL` | `http://127.0.0.1:3000/api` | CMS API base URL |
| `CMS_PORT` | `3000` | Port for the CMS server |
| `XAI_API_KEY` | — | xAI API key for breed/comparison generation |
| `GENERATE_API_KEY` | — | Shared secret for `POST /api/generate/*`. Unset = those endpoints return 503 |
| `BREVO_API_KEY` | — | Brevo key for newsletter and quiz-result email |
| `CMS_EMAIL` | — | CMS admin email |
| `CMS_PASSWORD` | — | CMS admin password |
| `DATABASE_URI` | `postgresql://localhost:5432/pawlabs` | PostgreSQL connection string |

---

## Project Structure

```
/srv/pet/
├── src/                    # Astro static site source
│   ├── pages/              # Route pages (index, quiz, breeds, compare)
│   ├── components/         # Shared components (Nav, Logo, Breadcrumbs, etc.)
│   ├── layouts/            # Layout wrapper (SEO, meta tags, analytics)
│   ├── lib/                # API client (payload.ts), SEO helpers
│   └── styles/             # Global CSS
├── cms/                    # Payload CMS (Next.js)
│   ├── src/collections/    # CMS collection schemas (Breeds, Comparisons, Media, Users)
│   ├── src/payload.config.ts
│   └── media/              # CMS-uploaded media files (source of truth)
├── public/media/           # Static media copies (served by the site)
├── scripts/
│   ├── sync-media.ts       # Media sync (prebuild hook)
│   └── image-health-check.ts # Image audit, repair, and daemon
├── dist/                   # Built static site output
└── .cache/payload/         # API response cache (build fallback)
```

---

## Common Workflows

### Add a new breed or comparison

```bash
systemctl is-active pawlabs-cms
# Then open http://localhost:3000/admin
#   • /admin/ai-breed          — generate a breed profile
#   • /admin/ai-breed-compare  — generate a head-to-head comparison
# Review the draft, set status to "published", then:
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
