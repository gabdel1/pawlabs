/**
 * The tool set, defined once.
 *
 * The hub page, the nav, the homepage showcase, each tool's "more tools" strip
 * and the sitemap all read from here, so adding a tool means adding one entry
 * rather than editing six files and forgetting the seventh.
 */

export interface ToolDef {
  slug: string;
  /** Used in nav, cards and breadcrumbs. */
  shortName: string;
  /** The <title> and the card heading. */
  title: string;
  /** The page's H1, which can be more conversational than the title. */
  h1: string;
  lede: string;
  cardBlurb: string;
  badge: string;
  emoji: string;
  /** Brand accent for the card and badge. */
  accent: string;
  /** Shows the veterinary disclaimer and marks the tool as health-related. */
  medical?: boolean;
  /** Highlighted first on the hub page. */
  featured?: boolean;
}

export const TOOLS: ToolDef[] = [
  {
    slug: 'dog-age-calculator',
    shortName: 'Dog age calculator',
    title: 'Dog Age Calculator: Dog Years to Human Years by Size',
    h1: 'How old is your dog, really?',
    lede: 'The "multiply by seven" rule is wrong twice over. Your dog ages fastest in its first two years, and after that the rate depends on how big it is. This does it properly.',
    cardBlurb: 'Dog years to human years, adjusted for size — because a Great Dane and a Chihuahua do not age alike.',
    badge: 'Age converter',
    emoji: '🎂',
    accent: '#26996F',
  },
  {
    slug: 'puppy-weight-calculator',
    shortName: 'Puppy weight predictor',
    title: 'Puppy Weight Calculator: How Big Will My Puppy Get?',
    h1: 'How big will your puppy get?',
    lede: 'Puppies reach a predictable share of their adult weight at each age — and that share depends on how big they will end up. Enter what yours weighs now.',
    cardBlurb: 'Predict adult weight from your puppy’s weight today, with an honest margin of error.',
    badge: 'Growth predictor',
    emoji: '📏',
    accent: '#1A758D',
  },
  {
    slug: 'dog-food-calculator',
    shortName: 'Food & calorie calculator',
    title: 'Dog Food Calculator: How Much Should I Feed My Dog?',
    h1: 'How much should your dog eat?',
    lede: 'The feeding guide on the bag is written for an average dog that does not exist. This uses the formula vets use, then converts it into cups of your actual food.',
    cardBlurb: 'Daily calories from the standard veterinary formula, converted into cups and meals.',
    badge: 'Feeding calculator',
    emoji: '🥣',
    accent: '#9C6611',
    medical: true,
    featured: true,
  },
  {
    slug: 'dog-chocolate-toxicity-calculator',
    shortName: 'Chocolate & grape checker',
    title: 'Dog Chocolate Toxicity Calculator + Grape & Raisin Checker',
    h1: 'Your dog ate chocolate. How worried should you be?',
    lede: 'Chocolate risk depends on the type, the amount and your dog’s weight — a lick of white chocolate and a square of baking chocolate are not the same event. Grapes are a different problem, and this page is straight with you about that.',
    cardBlurb: 'Work out the methylxanthine dose from what your dog ate — and what to do about it.',
    badge: 'Emergency checker',
    emoji: '🚨',
    accent: '#A23B3B',
    medical: true,
    featured: true,
  },
  {
    slug: 'dog-pregnancy-calculator',
    shortName: 'Pregnancy due date',
    title: 'Dog Pregnancy Calculator: Due Date & Whelping Timeline',
    h1: 'When are the puppies due?',
    lede: 'Canine gestation is about 63 days — but counted from ovulation, not from mating. That difference is why so many litters arrive "early". Here is the date, the window, and what happens between now and then.',
    cardBlurb: 'Due date, whelping window and the full week-by-week timeline with vet appointments marked.',
    badge: 'Whelping planner',
    emoji: '🍼',
    accent: '#7A4E8C',
    medical: true,
  },
];

export function toolBySlug(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
