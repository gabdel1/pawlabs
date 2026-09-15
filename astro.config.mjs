// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://pawlabs.org',
  output: 'static',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/api') &&
        // Everything *under* /embed is machinery — the widget itself carries
        // noindex and must not compete with real pages. /embed (the generator)
        // stays in: it is a normal indexable landing page.
        !/\/embed\/.+/.test(page),
      /**
       * Strip trailing slashes so sitemap URLs match the canonical tags the
       * pages actually emit (Layout.astro builds those without one).
       *
       * When they disagree, Google fetches the sitemap URL, reads a canonical
       * pointing somewhere else, and drops the submitted URL — which shows up
       * in the Pages report as "Alternate page with proper canonical tag".
       *
       * The homepage keeps its slash, because its canonical is the bare origin
       * with a trailing slash.
       */
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/') {
          url.pathname = url.pathname.replace(/\/+$/, '');
        }
        item.url = url.toString();
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Inline small stylesheets for faster rendering
    inlineStylesheets: 'auto',
  },
});