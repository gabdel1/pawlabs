# 🐾 PawLabs

A dog breed encyclopedia built with **Astro** (frontend) and **Payload CMS** (backend).

## Project Structure

```
/srv/pet/
├── src/                    # Astro frontend
│   ├── layouts/Layout.astro
│   ├── components/
│   │   ├── BreedComparisonTable.astro
│   │   ├── Nav.astro / Footer.astro
│   │   └── NewsletterSignup.astro
│   ├── pages/
│   │   ├── index.astro         # Breed encyclopedia landing page
│   │   ├── quiz.astro          # Breed Match quiz (cornerstone feature)
│   │   ├── breeds/             # Breed index + profiles
│   │   └── compare/            # Comparison hub + articles
│   ├── lib/
│   │   ├── payload.ts      # CMS API client (with build-time cache)
│   │   ├── quiz.ts         # Quiz questions, fetched at build time
│   │   └── traits.ts       # Trait labels (safe to import client-side)
│   └── styles/global.css   # Tailwind CSS
├── astro.config.mjs        # Astro + Tailwind + Node adapter
├── package.json            # Astro dependencies
│
└── cms/                    # Payload CMS (Next.js)
    ├── src/
    │   ├── collections/
    │   │   ├── Breeds.ts          # Breed profiles + trait ratings
    │   │   ├── Comparisons.ts     # Head-to-head breed comparisons
    │   │   ├── QuizQuestions.ts   # Breed Match questions + trait weights
    │   │   ├── QuizSubmissions.ts # Completed quiz runs (leads + notes)
    │   │   ├── Media.ts           # Image uploads
    │   │   └── Users.ts           # Admin authentication
    │   ├── components/         # Custom admin views (AI generators)
    │   ├── lib/                # Grok API clients, Brevo helper
    │   ├── scripts/            # Seed scripts
    │   ├── migrations/
    │   └── app/(payload)/      # Next.js admin + API routes
    ├── .env                 # Postgres + API key config
    └── package.json         # CMS dependencies
```

## Getting Started

### 1. Install dependencies

```bash
npm install && cd cms && npm install
```

### 2. Start development servers

```bash
# Terminal 1 - Astro frontend (port 4321)
npm run dev

# Terminal 2 - Payload CMS admin (port 3000)
cd cms && npm run dev
```

### 3. Access the apps

- **Frontend**: http://localhost:4321
- **CMS Admin**: http://localhost:3000/admin

## CMS Collections

### Breeds
The core of the encyclopedia. Fields: name, slug, breed group, size, height/weight ranges,
life expectancy, coat type/length, colors, origin, temperament, strengths/weaknesses,
breed history, long-form article, featured image, status (draft/published).

Each breed is scored 1–10 across 14 traits: affection, child/pet/stranger friendliness,
trainability, energy, grooming needs, shedding, barking, intelligence, playfulness,
watchdog ability, adaptability, and health robustness.

### Comparisons
Long-form head-to-head breed articles. Fields: title, slug, summary, content (HTML),
compared breeds (relationship), comparison criteria, verdict (HTML), author,
featured image, published date, status.

The comparison table derives its criteria from breed trait ratings — some are inverted
(e.g. "Low Shedding" is `11 - sheddingLevel`) so higher always means better.

## Breed Match Quiz

The site's cornerstone feature, at **`/quiz`**. Ten questions about the visitor's home,
week and household, then three breed recommendations written for them specifically.

**How a match is made** — two stages, so the AI never reasons over 200 breeds at once
and the quiz still works when xAI is down:

1. **Trait scoring.** Every answer option carries trait weights (a target score 1–10 for
   one of the 14 breed traits, plus how much it matters). All published breeds are scored
   against the answers; the top 40 go forward.
2. **Grok picks and writes.** It chooses three from that shortlist and writes the
   personalised read — why each fits, what to watch out for, a day in the life.

If step 2 fails, step 1's ranking is returned with templated copy. The visitor always
gets a result.

Weights live in the CMS and are looked up server-side by answer key — the browser only
ever sends which option was picked, so the match cannot be steered from the client.

### Quiz Questions (CMS)

Questions are ordinary CMS documents, editable by hand at
`/admin/collections/quiz-questions`. Each has a stable `key` (used in stored answers),
an order, a pet scope (dogs, cats, or both), an answer type (pick one / pick several /
free text), and options carrying the trait weights.

Seed or re-seed the baseline set:

```bash
cd cms && npx tsx src/scripts/seed-quiz-questions.ts
```

Existing keys are skipped so hand-tuned weights survive; pass `--force` to overwrite.

### Quiz Submissions

Every completed run is stored at `/admin/collections/quiz-submissions`: the answers, what
we recommended, and the email if they gave one (which is also subscribed in Brevo, tagged
`SOURCE=breed-quiz`). The **Visitor Note** field — the "anything we forgot to ask?" box at
the end of the quiz — is the raw material for the next batch of questions.

## Structured Data

JSON-LD is generated in `src/lib/seo.ts` and emitted through the `jsonLd` prop on
`Layout.astro`. Current coverage:

| Page | Schema |
|---|---|
| Homepage | `WebSite`, `Organization` (with contact point, publishing principles, corrections policy) |
| Breed profile | `Article` (author + publisher), `FAQPage`, `BreadcrumbList` |
| Breeds index | `CollectionPage` → `ItemList` of every published breed, `BreadcrumbList` |
| Comparison | `Article`, `BreadcrumbList` |
| Quiz | `WebApplication`, `BreadcrumbList` |
| About / Contact / policies | `AboutPage` / `ContactPage` / `WebPage`, `BreadcrumbList` |

Breed FAQs are **derived from trait scores** in `src/lib/breed-faq.ts` — ten questions
per breed covering children, other pets, exercise, shedding, training, lifespan, size,
noise, apartments and first-time owners. The page renders the array visibly and the
`FAQPage` markup is generated from that same array, so schema can never drift from what a
reader sees. Answers cite the actual 1–10 score, so they cannot contradict the ratings
shown elsewhere on the page.

> Google restricted FAQ *rich results* in August 2023 to well-known authoritative
> government and health sites, so do not expect expanded snippets from this. The markup is
> cheap and helps machine consumers; the visible FAQ section is the real benefit.

To verify the whole site's structured data after a change, parse every block:

```bash
python3 -c "import re,json,glob; [json.loads(b) for f in glob.glob('dist/**/index.html',recursive=True) for b in re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>',open(f).read(),re.S)] and print('all JSON-LD valid')"
```

## AI Generation

Three custom admin views generate content via the Grok API (requires `XAI_API_KEY` in `cms/.env`):

- **AI Breeds** (`/admin/ai-breed`) — generate a full breed profile with trait ratings
- **Breed Compare** (`/admin/ai-breed-compare`) — generate a head-to-head comparison from 2+ breeds
- **AI Quiz Questions** (`/admin/ai-quiz`) — draft quiz questions from notes

All save as **drafts** for review before publishing.

The quiz generator takes free-text notes — your own, or loaded straight from what quiz
takers left in that note box — and returns questions with the trait weights already set.
Review the weights before publishing: they are what actually moves the match.

## Tech Stack

- **Astro** with TypeScript + Tailwind CSS v4
- **Payload CMS 3.x** with Lexical editor + PostgreSQL
- **Next.js 15** for CMS admin panel
