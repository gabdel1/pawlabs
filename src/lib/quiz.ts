/**
 * Breed Match quiz data, pulled from the CMS at build time.
 *
 * The questions ship inside the static page, so the quiz starts instantly and
 * keeps working even if the CMS is down. Only the final match — the part that
 * needs Grok and the live breed list — hits the API at runtime.
 *
 * Trait weights are deliberately NOT shipped to the browser. The client sends
 * back which option was picked; the server looks the weights up itself.
 */

import { fetchAPI, type PayloadResponse } from './payload';

/** Where the browser posts quiz answers. Same origin as the CMS API. */
export const QUIZ_API_URL = 'https://pawlabs.org/api/quiz/match';

export type QuizPetType = 'dog' | 'cat' | 'either';

export interface QuizOption {
  label: string;
  value: string;
  emoji?: string;
  description?: string;
}

export interface QuizQuestion {
  key: string;
  question: string;
  helper?: string;
  emoji?: string;
  type: 'single' | 'multi' | 'text';
  layout: 'grid' | 'list' | 'scale';
  petScope: 'both' | 'dog' | 'cat';
  required: boolean;
  maxSelections?: number;
  placeholder?: string;
  options: QuizOption[];
}

interface RawQuizQuestion extends Omit<QuizQuestion, 'options'> {
  id: string;
  order: number;
  status: string;
  options?: (QuizOption & { id?: string })[];
}

/** Strip CMS bookkeeping and trait weights down to what the browser needs. */
function toQuizQuestion(raw: RawQuizQuestion): QuizQuestion {
  return {
    key: raw.key,
    question: raw.question,
    helper: raw.helper || undefined,
    emoji: raw.emoji || undefined,
    type: raw.type ?? 'single',
    layout: raw.layout ?? 'grid',
    petScope: raw.petScope ?? 'both',
    required: raw.required !== false,
    maxSelections: raw.maxSelections || undefined,
    placeholder: raw.placeholder || undefined,
    options: (raw.options ?? []).map((o) => ({
      label: o.label,
      value: o.value,
      emoji: o.emoji || undefined,
      description: o.description || undefined,
    })),
  };
}

/** Every published question, in ask order. */
export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  try {
    const data = await fetchAPI<PayloadResponse<RawQuizQuestion>>('quiz-questions', {
      'where[status][equals]': 'published',
      limit: '100',
      depth: '0',
      sort: 'order',
    });
    return data.docs
      .filter((q) => q.key && q.question)
      .filter((q) => q.type === 'text' || (q.options ?? []).length >= 2)
      .map(toQuizQuestion);
  } catch (e) {
    console.error('[quiz] Failed to fetch quiz questions:', e);
    return [];
  }
}

/** Questions asked for a given pet type, in order. */
export function questionsForPetType(questions: QuizQuestion[], petType: QuizPetType): QuizQuestion[] {
  if (petType === 'either') return questions.filter((q) => q.petScope === 'both');
  return questions.filter((q) => q.petScope === 'both' || q.petScope === petType);
}

/**
 * How many questions someone actually answers — the number we put on the page.
 * Whichever pet type asks the fewest, so the promise is never overstated.
 */
export function quizLength(questions: QuizQuestion[]): number {
  const counts = (['dog', 'cat'] as const)
    .map((t) => questionsForPetType(questions, t).filter((q) => q.type !== 'text').length)
    .filter((n) => n > 0);
  return counts.length ? Math.min(...counts) : questions.filter((q) => q.type !== 'text').length;
}
