/**
 * Site identity, contact routing and editorial attribution.
 *
 * Single source of truth for the facts that appear across the trust and
 * compliance pages, so a change of address or byline is one edit rather than a
 * hunt through templates.
 */

export const SITE_URL = 'https://pawlabs.org';
export const SITE_NAME = 'PawLabs';

/** Monitored inbox. Affiliate networks and ad reviewers do send test mail here. */
export const CONTACT_EMAIL = 'contact@pawlabs.org';

/**
 * Google Search Console HTML-tag verification token — the value from the
 * `content="..."` attribute only, not the whole meta tag.
 *
 * Leave empty if you verified by DNS TXT instead; the meta tag is then
 * unnecessary and nothing is rendered.
 */
export const GOOGLE_SITE_VERIFICATION = '';

/**
 * Google AdSense publisher ID. Rendered site-wide from Layout.astro.
 *
 * Deliberately NOT applied to /embed/compare, which is a standalone document:
 * that widget runs inside other people's pages and the /embed landing page
 * promises it loads no third-party or tracking scripts.
 *
 * Set to '' to pull the tag from the whole site.
 */
export const ADSENSE_CLIENT = 'ca-pub-7946556320800279';

/** Routed addresses shown on the Contact page. */
export const CONTACT_ROUTES = [
  {
    key: 'general',
    label: 'General questions',
    email: CONTACT_EMAIL,
    subject: 'Question',
    blurb: 'Anything about the site, a breed, or how we score things.',
  },
  {
    key: 'corrections',
    label: 'Corrections',
    email: CONTACT_EMAIL,
    subject: 'Correction',
    blurb: 'Something factually wrong? This one gets read first.',
  },
  {
    key: 'privacy',
    label: 'Privacy & data requests',
    email: CONTACT_EMAIL,
    subject: 'Data request',
    blurb: 'Access, deletion, or a question about what we store.',
  },
  {
    key: 'press',
    label: 'Press & partnerships',
    email: CONTACT_EMAIL,
    subject: 'Press',
    blurb: 'Interviews, data requests from journalists, commercial enquiries.',
  },
] as const;

/**
 * The byline on breed profiles and comparisons.
 *
 * Deliberately an editorial team rather than an invented individual: the
 * profiles are drafted with AI assistance against published breed standards and
 * reviewed before publishing, and saying so plainly is more defensible — and
 * more useful to a reader — than a credential nobody can verify.
 */
export const EDITORIAL_TEAM = {
  name: 'PawLabs Editorial Team',
  role: 'Breed research & editorial',
  url: `${SITE_URL}/about#who-writes-this`,
  short: 'Researched and reviewed by the PawLabs Editorial Team.',
  bio: `We build PawLabs from published kennel club breed standards and veterinary reference sources. Profiles are drafted with AI assistance against that source data, then reviewed and corrected by a person before anything is published. We say so because you should know how the thing you're reading was made.`,
} as const;

/** Shown under the byline so readers know what a profile is and is not. */
export const CONTENT_DISCLAIMER =
  'Breed profiles are general reference, not veterinary advice. For anything concerning your own animal, talk to a vet who can examine them.';

/**
 * Last substantive revision of the policy pages.
 * Update when the wording changes, not on every deploy.
 */
export const POLICY_UPDATED = '2026-09-17';

export function formatPolicyDate(iso: string = POLICY_UPDATED): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Third parties that actually receive data, described on the Privacy page. */
export const DATA_PROCESSORS = [
  {
    name: 'Google Analytics 4',
    purpose: 'Aggregate traffic measurement — which pages get read, roughly where visitors come from.',
    data: 'IP address (truncated by Google), device and browser type, pages viewed, referring site.',
    policy: 'https://policies.google.com/privacy',
  },
  {
    name: 'Google Fonts',
    purpose: 'Serves the two typefaces the site uses.',
    data: 'IP address and browser headers, at the moment the font file is requested.',
    policy: 'https://policies.google.com/privacy',
  },
  {
    name: 'Brevo',
    purpose: 'Sends the newsletter and quiz results. Only used if you give us an email address.',
    data: 'Email address, the source that captured it, and your top breed match if you took the quiz.',
    policy: 'https://www.brevo.com/legal/privacypolicy/',
  },
  {
    name: 'Impact',
    purpose: 'Affiliate link tracking, so partners can attribute a purchase to a referral from this site.',
    data: 'Referral and click data when you follow an affiliate link off the site.',
    policy: 'https://impact.com/privacy-policy/',
  },
  {
    name: 'Google AdSense',
    purpose: 'Serves the display advertising that pays for the site.',
    data: 'IP address, device and browser type, and pages viewed. May set cookies to limit how often you see the same ad and, where you have allowed it, to personalise what is shown.',
    policy: 'https://policies.google.com/technologies/ads',
  },
] as const;
