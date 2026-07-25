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
│   │   ├── breeds/             # Breed index + profiles
│   │   └── compare/            # Comparison hub + articles
│   ├── lib/payload.ts      # CMS API client (with build-time cache)
│   └── styles/global.css   # Tailwind CSS
├── astro.config.mjs        # Astro + Tailwind + Node adapter
├── package.json            # Astro dependencies
│
└── cms/                    # Payload CMS (Next.js)
    ├── src/
    │   ├── collections/
    │   │   ├── Breeds.ts       # Breed profiles + trait ratings
    │   │   ├── Comparisons.ts  # Head-to-head breed comparisons
    │   │   ├── Media.ts        # Image uploads
    │   │   └── Users.ts        # Admin authentication
    │   ├── components/         # Custom admin views (AI generators)
    │   ├── lib/                # Grok API clients
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

## AI Generation

Two custom admin views generate content via the Grok API (requires `XAI_API_KEY` in `cms/.env`):

- **AI Breeds** (`/admin/ai-breed`) — generate a full breed profile with trait ratings
- **Breed Compare** (`/admin/ai-breed-compare`) — generate a head-to-head comparison from 2+ breeds

Both save as **drafts** for review before publishing.

## Tech Stack

- **Astro** with TypeScript + Tailwind CSS v4
- **Payload CMS 3.x** with Lexical editor + PostgreSQL
- **Next.js 15** for CMS admin panel
