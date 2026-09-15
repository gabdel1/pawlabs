/**
 * Breed FAQs, derived from trait data.
 *
 * These are the questions people actually type — "is a Golden Retriever good
 * with kids", "does a Husky shed a lot" — and we already hold the data to
 * answer them. Generating them from the trait scores rather than writing them
 * by hand means every profile gets them, and an answer can never contradict the
 * ratings shown elsewhere on the same page.
 *
 * The page renders this array visibly AND emits it as FAQPage JSON-LD, so the
 * markup always matches what a reader sees — which is what Google requires.
 */

import type { Breed } from './payload';
import type { FamilyRoundupLink } from './meta';

export interface BreedFaq {
  question: string;
  answer: string;
  /**
   * The same text as `answer`, with an anchor wrapped around part of it.
   *
   * Present only where the answer carries a link. The page renders this when it
   * exists and the plain string otherwise; FAQPage JSON-LD always uses `answer`,
   * so the marked-up text stays character-for-character identical to what a
   * reader sees — which is what Google requires of FAQ markup.
   */
  answerHtml?: string;
}

/** Minimal escaping for text interpolated into answerHtml. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const clamp = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

/** Trait value, or null when the profile has not been scored for it. */
function trait(breed: Breed, key: keyof NonNullable<Breed['traits']>): number | null {
  const raw = breed.traits?.[key];
  return typeof raw === 'number' && !Number.isNaN(raw) ? clamp(raw) : null;
}

/** Pick the band a score falls into. Bands are [1-2, 3-4, 5-6, 7-8, 9-10]. */
function band<T>(score: number, bands: [T, T, T, T, T]): T {
  if (score <= 2) return bands[0];
  if (score <= 4) return bands[1];
  if (score <= 6) return bands[2];
  if (score <= 8) return bands[3];
  return bands[4];
}

export interface BreedFaqOptions {
  /** Roundup about children to cite in the child-friendliness answer, if any. */
  familyRoundup?: FamilyRoundupLink | null;
}

export function buildBreedFaqs(breed: Breed, options: BreedFaqOptions = {}): BreedFaq[] {
  const name = breed.name;
  const isCat = breed.petType === 'cat';
  const faqs: BreedFaq[] = [];

  // ── Children ──────────────────────────────────────────
  const childFriendly = trait(breed, 'childFriendly');
  if (childFriendly !== null) {
    const verdict = band(childFriendly, [
      `generally not a good match for homes with young children`,
      `better suited to households with older, calmer children`,
      `usually fine with children who have been taught to handle a ${isCat ? 'cat' : 'dog'} respectfully`,
      `a good match for families with children`,
      `one of the most child-tolerant breeds we have profiled`,
    ]);
    const base = `The ${name} scores ${childFriendly}/10 for child-friendliness, making it ${verdict}. That score reflects the breed's typical temperament, not any individual animal — early socialisation and how the ${isCat ? 'cat' : 'dog'} was raised matter just as much. Supervise interactions with toddlers whatever the breed.`;

    // Where the breed is ranked in one of our own guides to living with
    // children, cite it here rather than only in the "Comparisons featuring"
    // list — this is the point in the page where a reader is asking the
    // question that article answers.
    const roundup = options.familyRoundup;
    const cite = roundup
      ? roundup.position
        ? ` We rank the ${name} #${roundup.position} of ${roundup.total} in ${roundup.title}.`
        : ` The ${name} is one of the breeds we assess in ${roundup.title}.`
      : '';

    faqs.push({
      question: `Is the ${name} good with children?`,
      answer: `${base}${cite}`,
      ...(roundup
        ? {
            answerHtml:
              escapeHtml(base) +
              escapeHtml(cite).replace(
                escapeHtml(roundup.title),
                `<a href="/compare/${roundup.slug}" class="underline underline-offset-2 decoration-brand-400 hover:text-brand-700 transition-colors">${escapeHtml(roundup.title)}</a>`,
              ),
          }
        : {}),
    });
  }

  // ── Other pets ────────────────────────────────────────
  const petFriendly = trait(breed, 'petFriendly');
  if (petFriendly !== null) {
    // Every band has to read correctly after "the {name} is …".
    const verdict = band(petFriendly, [
      `often best as the only pet in the home`,
      `prone to friction with other animals, and needs careful, slow introductions`,
      `usually fine with other pets once introduced properly`,
      `generally sociable with other dogs and cats`,
      `typically very easy-going with other animals`,
    ]);
    faqs.push({
      question: `Does the ${name} get along with other pets?`,
      answer: `Scoring ${petFriendly}/10 for pet-friendliness, the ${name} is ${verdict}. Prey drive matters here as well as sociability: breeds built to chase can live happily with a household cat they grew up with and still pursue an unfamiliar one.`,
    });
  }

  // ── Exercise ──────────────────────────────────────────
  const energy = trait(breed, 'energyLevel');
  if (energy !== null) {
    const requirement = band(energy, [
      `around 20–30 minutes of gentle activity a day`,
      `roughly 30–45 minutes a day`,
      `about an hour a day`,
      `at least an hour to 90 minutes a day, and it should be real exercise rather than a stroll`,
      `two hours or more a day, every day, including the days you do not feel like it`,
    ]);
    const consequence = energy >= 7
      ? ` Under-exercised, this is a breed that finds its own entertainment — usually at the expense of your furniture.`
      : energy <= 2
        ? ` This is a breed that genuinely does not need a great deal, which suits a quieter household.`
        : '';
    faqs.push({
      question: `How much exercise does the ${name} need?`,
      answer: `The ${name} rates ${energy}/10 for energy and needs ${requirement}.${consequence}${breed.breedRole ? ` The breed was originally developed for ${breed.breedRole.toLowerCase()}, which is where that requirement comes from.` : ''}`,
    });
  }

  // ── Shedding ──────────────────────────────────────────
  const shedding = trait(breed, 'sheddingLevel');
  if (shedding !== null) {
    const verdict = band(shedding, [
      `sheds very little, which makes it a reasonable option if hair around the house is a dealbreaker`,
      `sheds lightly`,
      `sheds a moderate amount year-round`,
      `sheds noticeably, and you will find hair on clothes and furniture`,
      `sheds heavily, often with seasonal blowouts that carpet the house`,
    ]);
    const coat = breed.coatType && breed.coatLength
      ? ` It has a ${breed.coatLength} ${breed.coatType} coat.`
      : '';
    faqs.push({
      question: `Does the ${name} shed a lot?`,
      answer: `At ${shedding}/10 for shedding, the ${name} ${verdict}.${coat} Worth knowing: low shedding is not the same as hypoallergenic — most people react to proteins in dander and saliva, not to hair itself, so no breed is genuinely allergy-free.`,
    });
  }

  // ── Training ──────────────────────────────────────────
  const trainability = trait(breed, 'trainability');
  const intelligence = trait(breed, 'intelligence');
  if (trainability !== null) {
    const verdict = band(trainability, [
      `one of the harder breeds to train, and a poor first choice for a novice owner`,
      `independent-minded and slow to comply, which takes patience`,
      `trainable with consistency, though not eager to please for its own sake`,
      `responsive and straightforward to train`,
      `exceptionally trainable, and happiest when it has something to learn`,
    ]);
    const iq = intelligence !== null
      ? ` It scores ${intelligence}/10 for intelligence — worth separating from trainability, because a clever breed that has decided not to listen is harder work than a simpler one that wants to.`
      : '';
    faqs.push({
      question: `Is the ${name} easy to train?`,
      answer: `The ${name} scores ${trainability}/10 for trainability, making it ${verdict}.${iq}`,
    });
  }

  // ── Lifespan ──────────────────────────────────────────
  if (breed.lifeExpectancyMin && breed.lifeExpectancyMax) {
    const health = trait(breed, 'healthRobustness');
    const healthNote = health !== null
      ? ` We rate the breed ${health}/10 for general health robustness${health <= 4 ? ', so budget for the possibility of ongoing veterinary costs' : ''}.`
      : '';
    faqs.push({
      question: `What is the average lifespan of the ${name}?`,
      answer: `The ${name} typically lives ${breed.lifeExpectancyMin}–${breed.lifeExpectancyMax} years.${healthNote} Individual lifespan depends heavily on genetics, weight management and veterinary care.`,
    });
  }

  // ── Size ──────────────────────────────────────────────
  if (breed.weightMin && breed.weightMax) {
    const height = breed.heightMin && breed.heightMax
      ? ` and stands roughly ${breed.heightMin}–${breed.heightMax} inches at the shoulder`
      : '';
    faqs.push({
      question: `How big does the ${name} get?`,
      answer: `A full-grown ${name} usually weighs ${breed.weightMin}–${breed.weightMax} lbs${height}. That places it in the ${breed.size ?? 'medium'} size band. Males generally sit at the upper end of both ranges.`,
    });
  }

  // ── Noise ─────────────────────────────────────────────
  const barking = trait(breed, 'barkingLevel');
  if (barking !== null) {
    const verb = isCat ? 'vocalise' : 'bark';
    const verdict = band(barking, [
      `is notably quiet`,
      `is fairly quiet and tends to ${verb} only with reason`,
      `${verb}s a moderate amount`,
      `${verb}s readily, which is worth considering if you have close neighbours`,
      `is a very vocal breed, and thin walls will make that everyone's problem`,
    ]);
    faqs.push({
      question: `Does the ${name} ${verb} a lot?`,
      answer: `Rated ${barking}/10 for ${isCat ? 'vocalisation' : 'barking'}, the ${name} ${verdict}. Training and adequate exercise both reduce nuisance ${isCat ? 'noise' : 'barking'}, but they will not turn a naturally vocal breed into a silent one.`,
    });
  }

  // ── Apartment suitability ─────────────────────────────
  const adaptability = trait(breed, 'adaptability');
  if (adaptability !== null && energy !== null && barking !== null) {
    // Small and adaptable helps; high energy and constant noise hurt.
    const sizePenalty = breed.size === 'giant' ? 2 : breed.size === 'large' ? 1 : 0;
    const score = adaptability + (10 - energy) + (10 - barking) - sizePenalty * 2;
    const suited =
      score >= 22
        ? `a genuinely good apartment breed`
        : score >= 16
          ? `workable in an apartment provided its exercise needs are met properly`
          : `a difficult fit for apartment living`;
    faqs.push({
      question: `Is the ${name} suited to apartment living?`,
      answer: `The ${name} is ${suited}. It scores ${adaptability}/10 for adaptability, ${energy}/10 for energy and ${barking}/10 for ${isCat ? 'vocalisation' : 'barking'} — the three traits that decide this. Floor space matters far less than whether the breed can settle indoors and stay quiet while you are out.`,
    });
  }

  // ── First-time owners ─────────────────────────────────
  if (trainability !== null && adaptability !== null) {
    const health = trait(breed, 'healthRobustness') ?? 5;
    const score = trainability + adaptability + health - (energy !== null && energy >= 8 ? 4 : 0);
    const verdict =
      score >= 22
        ? `a sound choice for a first-time owner`
        : score >= 16
          ? `manageable for a first-time owner who is willing to put the work in early`
          : `better suited to someone who has raised a ${isCat ? 'cat' : 'dog'} before`;
    faqs.push({
      question: `Is the ${name} a good choice for first-time owners?`,
      answer: `On balance the ${name} is ${verdict}, based on its trainability (${trainability}/10), adaptability (${adaptability}/10)${energy !== null ? ` and energy level (${energy}/10)` : ''}. The most common reason a first ${isCat ? 'cat' : 'dog'} does not work out is a mismatch between the breed's daily needs and the owner's actual routine, rather than anything about the breed itself.`,
    });
  }

  return faqs;
}
