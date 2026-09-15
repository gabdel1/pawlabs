import type { APIRoute } from 'astro';
import { getBreeds, getMediaUrl } from '../../lib/payload';
import type { Media } from '../../lib/payload';

/**
 * Breed data for the embeddable widget, emitted as a static file at build time.
 *
 * Keys are deliberately single letters and traits are a fixed-order array: this
 * file is fetched by every embed on every third-party page load, so bytes here
 * are the widget's whole transfer budget. ~200 breeds lands around 15KB, which
 * gzips to a few KB.
 *
 * Trait order: energy, shedding, trainability, kids, barking, grooming.
 */

export const prerender = true;

const TRAIT_ORDER = [
  'energyLevel',
  'sheddingLevel',
  'trainability',
  'childFriendly',
  'barkingLevel',
  'groomingNeeds',
] as const;

export const GET: APIRoute = async () => {
  const breeds = await getBreeds();

  const payload = {
    // Consumers resolve images and links against this, so the widget works
    // identically from any origin.
    origin: 'https://pawlabs.org',
    traits: ['Energy', 'Shedding', 'Trainability', 'Good with kids', 'Barking', 'Grooming'],
    breeds: breeds
      .filter((b) => b.slug && b.name)
      .map((breed) => {
        const media = getMediaUrl(breed.image as Media);
        return {
          s: breed.slug,
          n: breed.name,
          // Store just the media path; the widget prefixes the origin.
          i: media ?? null,
          t: TRAIT_ORDER.map((key) => {
            const value = breed.traits?.[key];
            return typeof value === 'number' ? Math.max(1, Math.min(10, Math.round(value))) : null;
          }),
        };
      }),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Embedded on third-party origins, so it must be fetchable cross-origin.
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
