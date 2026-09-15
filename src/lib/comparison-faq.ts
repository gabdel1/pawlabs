/**
 * FAQs for comparison articles, extracted from the article's own prose.
 *
 * Unlike the breed FAQs — which are generated from trait scores — these must
 * quote the page. Google treats FAQ markup whose answers are not visible on the
 * page as a violation, so every answer here is lifted verbatim from the
 * article body or the verdict, and the page also renders the Q&A visibly.
 *
 * Extraction is deliberately conservative: if a section cannot be matched to a
 * question, no question is invented for it.
 */

import type { Breed, Comparison } from './payload';

export interface ComparisonFaq {
  question: string;
  answer: string;
}

/** Named and numeric HTML entities that show up in generated copy. */
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** HTML → plain text. Tags removed, entities decoded, whitespace collapsed. */
export function stripHtml(html: string): string {
  return html
    // Block boundaries become spaces so words do not run together.
    .replace(/<\/(p|h[1-6]|li|div|section|tr)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Take the opening sentence or two, without cutting mid-sentence.
 * Returns '' when there is not enough usable text to answer with.
 */
function firstSentences(text: string, maxSentences = 2, cap = 330): string {
  const clean = text.trim();
  if (clean.length < 40) return '';

  const sentences = clean.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  if (!sentences) {
    // No terminator found — only usable if it is already short enough.
    return clean.length <= cap ? clean : '';
  }

  // Trim each sentence before joining — the matcher keeps the leading space
  // that follows the previous terminator, which would otherwise double up.
  const picked: string[] = [];
  for (const sentence of sentences.slice(0, maxSentences)) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const candidate = [...picked, trimmed].join(' ');
    if (candidate.length > cap) break;
    picked.push(trimmed);
  }

  const out = picked.join(' ');
  return out.length >= 40 ? out : '';
}

interface Section {
  heading: string;
  text: string;
}

/**
 * Split article HTML into heading/body sections.
 *
 * Content from both writers is a flat run of h2/h3 followed by paragraphs, so a
 * split on headings is enough — no tree walking required.
 */
export function extractSections(html: string): Section[] {
  if (!html) return [];
  const parts = html.split(/(<h[23][^>]*>.*?<\/h[23]>)/gis);
  const sections: Section[] = [];
  let pending: string | null = null;

  for (const part of parts) {
    if (!part?.trim()) continue;
    if (/^<h[23]/i.test(part)) {
      pending = stripHtml(part);
      continue;
    }
    if (pending) {
      const text = stripHtml(part);
      if (text) sections.push({ heading: pending, text });
      pending = null;
    }
  }

  return sections;
}

/** Subject phrase for question templates: "the A or the B" / "these breeds". */
function subject(breeds: Breed[]): string {
  const names = breeds.map((b) => b.name).filter(Boolean);
  if (names.length === 2) return `the ${names[0]} or the ${names[1]}`;
  if (names.length === 3) return `the ${names[0]}, ${names[1]} or ${names[2]}`;
  return 'these breeds';
}

/** Shorter subject for questions that read badly with a long list. */
function shortSubject(breeds: Breed[]): string {
  const names = breeds.map((b) => b.name).filter(Boolean);
  return names.length === 2 ? `the ${names[0]} or the ${names[1]}` : 'these breeds';
}

interface Topic {
  /** Matched against the section heading. */
  match: RegExp;
  question: (breeds: Breed[]) => string;
}

/**
 * Section-heading topics, most valuable first. Only one question is produced
 * per topic, so a long article does not yield six near-identical entries.
 */
const TOPICS: Topic[] = [
  {
    match: /child|kid|famil|toddler/i,
    question: (b) => `Is ${shortSubject(b)} better for families with children?`,
  },
  {
    match: /energy|exercise|activ|stamina/i,
    question: (b) => `Which needs more exercise, ${shortSubject(b)}?`,
  },
  {
    match: /train|intellig|obedien|biddab/i,
    question: (b) => `Which is easier to train, ${shortSubject(b)}?`,
  },
  {
    match: /groom|shed|coat|maintenance|allerg/i,
    question: (b) => `Which is lower maintenance to groom, ${shortSubject(b)}?`,
  },
  {
    match: /apartment|space|adapt|living|home|lifestyle/i,
    question: (b) => `Which is better suited to apartment living, ${shortSubject(b)}?`,
  },
  {
    match: /bark|watchdog|guard|noise|protect/i,
    question: (b) => `Which makes the better watchdog, ${shortSubject(b)}?`,
  },
  {
    match: /health|longev|lifespan|vet|condition/i,
    question: (b) => `Which is the healthier breed, ${shortSubject(b)}?`,
  },
  {
    match: /pet-friendly|other pets|dogs and cats|multi-pet/i,
    question: (b) => `Which gets along better with other pets, ${shortSubject(b)}?`,
  },
];

/**
 * The audience a roundup is written for, taken from its own title.
 * "Best Dogs for People Working Full Time" → "people working full time".
 */
function angleFromTitle(title: string): string | null {
  const clean = title.replace(/[?:.]+\s*$/, '').trim();
  const ranked = clean.match(/\branked\s+for\s+(.+)$/i);
  if (ranked) return ranked[1].trim().toLowerCase();
  const generic = clean.match(/\bfor\s+(.+)$/i);
  if (generic) return generic[1].trim().toLowerCase();
  return null;
}

/** Roundup sections are numbered per breed: "1. Border Terrier". */
const RANKED_HEADING = /^\s*(\d+)\s*[.)]\s*(.+?)\s*$/;

/**
 * Roundups have no topical headings to match — every h3 is a breed name — so
 * they get their own treatment: what the article is looking for, why the top
 * picks made it, and the verdict.
 */
function buildRoundupFaqs(
  comparison: Comparison,
  sections: Section[],
  limit: number,
): ComparisonFaq[] {
  const faqs: ComparisonFaq[] = [];
  const angle = angleFromTitle(comparison.title ?? '');
  const forAngle = angle ? ` for ${angle}` : '';

  const ranked = sections
    .map((s) => ({ section: s, match: s.heading.match(RANKED_HEADING) }))
    .filter((x) => x.match)
    .map((x) => ({ rank: Number(x.match![1]), name: x.match![2], text: x.section.text }))
    .sort((a, b) => a.rank - b.rank);

  // The framing section — what actually matters for this reader.
  const intro = sections.find((s) => !RANKED_HEADING.test(s.heading));
  if (intro) {
    const answer = firstSentences(intro.text);
    if (answer) {
      faqs.push({
        question: angle
          ? `What makes a dog a good fit for ${angle}?`
          : 'What should you look for in these breeds?',
        answer,
      });
    }
  }

  // Why the top-ranked picks earned their place.
  for (const entry of ranked.slice(0, 2)) {
    if (faqs.length >= limit - 1) break;
    const answer = firstSentences(entry.text);
    if (!answer) continue;
    faqs.push({
      question: `Is the ${entry.name} a good choice${forAngle}?`,
      answer,
    });
  }

  const verdict = firstSentences(stripHtml(comparison.verdict ?? ''), 2, 360);
  if (verdict && faqs.length < limit) {
    faqs.push({
      question: angle ? `Which dog is best${forAngle}?` : 'Which breed comes out on top?',
      answer: verdict,
    });
  }

  return faqs;
}

/**
 * Build 3-4 Q&A pairs for a comparison.
 *
 * Every answer is a verbatim extract from the article or verdict — nothing is
 * paraphrased or invented, so the markup always matches the visible page.
 */
export function buildComparisonFaqs(
  comparison: Comparison,
  breeds: Breed[],
  limit = 4,
): ComparisonFaq[] {
  const sections = extractSections(comparison.content ?? '');

  // Ranked roundups are structured completely differently from head-to-heads.
  if (sections.some((s) => RANKED_HEADING.test(s.heading))) {
    const roundup = buildRoundupFaqs(comparison, sections, limit);
    return roundup.length >= 3 ? roundup.slice(0, limit) : [];
  }

  const faqs: ComparisonFaq[] = [];
  const usedTopics = new Set<RegExp>();

  for (const section of sections) {
    if (faqs.length >= limit - 1) break; // leave room for the verdict question
    for (const topic of TOPICS) {
      if (usedTopics.has(topic.match)) continue;
      if (!topic.match.test(section.heading)) continue;

      const answer = firstSentences(section.text);
      if (!answer) continue;

      usedTopics.add(topic.match);
      faqs.push({ question: topic.question(breeds), answer });
      break;
    }
  }

  // The verdict answers the question people actually arrived with.
  const verdict = firstSentences(stripHtml(comparison.verdict ?? ''), 2, 360);
  if (verdict && faqs.length < limit) {
    faqs.push({
      question: `Which should you choose, ${subject(breeds)}?`,
      answer: verdict,
    });
  }

  // Fewer than three is not worth marking up.
  return faqs.length >= 3 ? faqs.slice(0, limit) : [];
}
