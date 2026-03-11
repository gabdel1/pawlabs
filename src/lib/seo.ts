/**
 * JSON-LD structured data generators for SEO.
 * Follows schema.org specifications for Product, Review, WebSite,
 * Organization, FAQPage, BreadcrumbList, and more.
 */

import type { Product, Review, Media } from './payload';
import { getMediaUrl, CATEGORY_LABELS, VERDICT_LABELS } from './payload';

const SITE_URL = 'https://pawlabs.org';
const SITE_NAME = 'PawLabs';
const SITE_DESCRIPTION = 'Expert pet product reviews and recommendations. Compare smart gadgets, toys, health products, and more for your pets.';

/** Generate JSON-LD for the Organization (shows as Knowledge Panel in Google) */
export function organizationJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    description: SITE_DESCRIPTION,
    foundingDate: '2026',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}`,
    },
  });
}

/** Generate JSON-LD for the website (used on homepage) */
export function websiteJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

/** Generate JSON-LD for a Product page */
export function productJsonLd(product: Product): string {
  const imageUrl = getMediaUrl(product.image as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url: `${SITE_URL}/products/${product.slug}`,
    description: product.shortDescription || `${product.name} - expert pet product review by PawLabs`,
    brand: {
      '@type': 'Brand',
      name: extractBrand(product.name),
    },
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  if (product.category) {
    schema.category = CATEGORY_LABELS[product.category] ?? product.category;
  }

  if (product.rating != null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
      reviewCount: 1,
    };
  }

  if (product.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: product.affiliateUrl || `${SITE_URL}/products/${product.slug}`,
      seller: {
        '@type': 'Organization',
        name: 'Amazon',
      },
    };
  }

  if (product.pros?.length) {
    schema.positiveNotes = {
      '@type': 'ItemList',
      itemListElement: product.pros.map((pro, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: pro.point,
      })),
    };
  }

  if (product.cons?.length) {
    schema.negativeNotes = {
      '@type': 'ItemList',
      itemListElement: product.cons.map((con, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: con.point,
      })),
    };
  }

  // Add Review snippet from the review body
  if (product.reviewBody) {
    schema.review = {
      '@type': 'Review',
      author: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
      },
      datePublished: product.updatedAt || product.createdAt,
      reviewBody: stripHtml(product.reviewBody).slice(0, 300),
      name: `${product.name} Review`,
      reviewRating: product.rating != null ? {
        '@type': 'Rating',
        ratingValue: product.rating,
        bestRating: 5,
        worstRating: 1,
      } : undefined,
    };
  }

  return JSON.stringify(schema);
}

/** Generate JSON-LD for a Review */
export function reviewJsonLd(review: Review, product: Product): string {
  const imageUrl = getMediaUrl(review.featuredImage as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.summary || '',
    datePublished: review.publishedDate || review.createdAt,
    itemReviewed: {
      '@type': 'Product',
      name: product.name,
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  if (review.author) {
    schema.author = {
      '@type': 'Person',
      name: review.author,
    };
  } else {
    schema.author = {
      '@type': 'Organization',
      name: SITE_NAME,
    };
  }

  if (review.overallRating != null) {
    schema.reviewRating = {
      '@type': 'Rating',
      ratingValue: review.overallRating,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return JSON.stringify(schema);
}

/** Generate JSON-LD for a comparison page */
export function comparisonJsonLd(product1: Product, product2: Product): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${product1.name} vs ${product2.name} - Comparison`,
    description: `Head-to-head comparison of ${product1.name} and ${product2.name}. Compare price, rating, features, pros and cons.`,
    url: `${SITE_URL}/compare/${product1.slug}-vs-${product2.slug}`,
    mainEntity: [
      { '@type': 'Product', name: product1.name, url: `${SITE_URL}/products/${product1.slug}` },
      { '@type': 'Product', name: product2.name, url: `${SITE_URL}/products/${product2.slug}` },
    ],
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.comparison-summary'],
    },
  });
}

/** Generate FAQ JSON-LD for product pages (helps get FAQ rich results) */
export function productFaqJsonLd(product: Product): string | null {
  const faqs: { question: string; answer: string }[] = [];

  if (product.price != null) {
    faqs.push({
      question: `How much does the ${product.name} cost?`,
      answer: `The ${product.name} is currently priced at $${product.price.toFixed(2)}. Check our affiliate link for the latest price and deals.`,
    });
  }

  if (product.pros?.length && product.cons?.length) {
    faqs.push({
      question: `Is the ${product.name} worth buying?`,
      answer: `Based on our testing, the ${product.name} ${product.rating && product.rating >= 4 ? 'is highly recommended' : 'has mixed results'}. Key pros include: ${product.pros.slice(0, 3).map(p => p.point).join('; ')}. However, watch out for: ${product.cons.slice(0, 2).map(c => c.point).join('; ')}.`,
    });
  }

  if (product.animalTypes?.length) {
    const types = product.animalTypes.join(', ');
    faqs.push({
      question: `What pets is the ${product.name} suitable for?`,
      answer: `The ${product.name} is designed for: ${types}. ${product.shortDescription || ''}`,
    });
  }

  if (faqs.length === 0) return null;

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}

/** Generate JSON-LD for the products listing page (CollectionPage) */
export function productsListJsonLd(products: Product[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'All Pet Products - PawLabs Reviews & Comparisons',
    description: 'Browse expert reviews of the best pet products — smart gadgets, wellness, security, food, and more for dogs, cats, and all pets.',
    url: `${SITE_URL}/products`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/products/${p.slug}`,
        name: p.name,
      })),
    },
  });
}

// ─── Helpers ──────────────────────────────────────────

/** Extract brand name from product name (first word or first two words) */
function extractBrand(name: string): string {
  const words = name.split(' ');
  if (words.length >= 2 && /^[A-Z]/.test(words[1])) {
    return `${words[0]} ${words[1]}`;
  }
  return words[0];
}

/** Strip HTML tags for plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Generate OpenGraph meta tag data */
export interface OGData {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
}

export function buildOGData(data: Partial<OGData> & { title: string }): OGData {
  return {
    title: data.title,
    description: data.description || SITE_DESCRIPTION,
    url: data.url || SITE_URL,
    image: data.image || null,
    type: data.type || 'website',
  };
}

export { SITE_URL, SITE_NAME, SITE_DESCRIPTION };
