# 🐾 Pet Smart Gadgets

Pet product reviews and affiliate marketing site built with **Astro** (frontend) and **Payload CMS** (backend).

## Project Structure

```
/srv/pet/
├── src/                    # Astro frontend
│   ├── layouts/Layout.astro
│   ├── pages/index.astro
│   └── styles/global.css   # Tailwind CSS
├── astro.config.mjs        # Astro + Tailwind + Node adapter
├── package.json            # Astro dependencies
│
└── cms/                    # Payload CMS (Next.js)
    ├── src/
    │   ├── collections/
    │   │   ├── Products.ts  # Product catalog schema
    │   │   ├── Reviews.ts   # Product reviews schema
    │   │   ├── Media.ts     # Image uploads
    │   │   └── Users.ts     # Admin authentication
    │   ├── payload.config.ts
    │   └── app/(payload)/   # Next.js admin routes
    ├── .env                 # SQLite database config
    └── package.json         # CMS dependencies
```

## Getting Started

### 1. Install dependencies

```bash
# Astro frontend (already installed)
npm install

# Payload CMS backend
cd cms && npm install
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
- **CMS Admin**: http://localhost:3000/admin (create your first admin user on first visit)

## CMS Collections

### Products
Fields: name, slug, description, price, affiliate URL, images, category, pet type, rating, pros/cons

Categories: Smart Gadgets, Toys, Food & Treats, Health & Wellness, Grooming, Beds & Furniture, Leashes & Collars, Travel

### Reviews
Fields: title, slug, product (relationship), content, summary, overall rating, rating breakdown (quality/value/ease/durability), verdict, affiliate URL, author, published date, status (draft/published)

## Tech Stack

- **Astro** with TypeScript + Tailwind CSS v4
- **Payload CMS 3.x** with Lexical editor + SQLite
- **Next.js 15** for CMS admin panel
