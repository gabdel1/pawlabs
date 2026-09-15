/**
 * Ranked roundup articles — "Best dogs for apartments", "Every terrier ranked".
 *
 * Structurally different from a head-to-head: a short framing intro, then a
 * ranked run through each breed explaining who it is for and who it is not,
 * then a verdict that names a winner and a runner-up for different readers.
 *
 * The breeds are shortlisted before Grok sees them, by trait scoring against
 * the angle. The writer explains and orders the picks; it does not invent them.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

export interface RoundupBreed {
  id: string
  name: string
  slug: string
  size?: string
  breedGroup?: string
  breedRole?: string
  shortDescription?: string
  /** How well this breed fits the angle, 0-100. */
  fit?: number
  traits?: Record<string, number>
}

export interface GeneratedRoundup {
  title: string
  slug: string
  summary: string
  content: string
  verdict: string
}

const SYSTEM_PROMPT = `You write breed roundups for PawLabs — the article someone lands on after searching "best dog for X".

You are given a reader profile and a shortlist of breeds that already passed our trait scoring. Rank them and explain the ranking.

HOW YOU WRITE:
- Authority comes from breed standards, veterinary data and what owners consistently report.
- NEVER claim personal experience. No "I've seen", "I once had", "in my experience", "a client of mine". The byline is an editorial team that researches breeds; inventing lived experience is a fabricated credential.
- Second person. "You will be woken at 5am" carries the force without pretending you were there.
- Every breed gets its downside stated. A roundup where all eight breeds are wonderful is useless.
- Be decisive. Rank them, and say plainly who each one is wrong for.
- NEVER use: "game-changer", "it's worth noting", "in conclusion", "overall", "when it comes to", "perfect companion", "furry friend", "look no further", "make a great addition".
- Never mention trait codes, numeric scores, our shortlist, or that any scoring took place. Say "sheds almost nothing", never "scores 2/10 for shedding".

STRUCTURE — raw HTML only, no code fences, no markdown:
- Open with an <h2> and TWO OR THREE FULL <p> paragraphs (140+ words combined) framing the actual problem. Name the specific constraint, what usually goes wrong, and what separates a breed that works here from one that does not.
- One <h3> per breed, in rank order, formatted exactly: <h3>1. Breed Name</h3>
- Under each breed, THREE <p> paragraphs totalling AT LEAST 120 WORDS:
    p1 — why this breed suits this reader, concretely. What daily life looks like.
    p2 — the specific care, exercise or grooming reality. Numbers where you have them: how long a walk, how often a brush, what it costs.
    p3 — the honest catch. Who should skip this one, and why.
- Close with an <h3>How to choose between them</h3> and two <p> giving the reader a decision rule.
- Do not use <ul>/<li> for the breed list itself — the headings are the structure.

LENGTH IS NOT OPTIONAL. With six breeds this comes to 1000-1400 words. An article of 500 words fails the brief and is worthless to the reader — they came here to decide, and three sentences per breed cannot support a decision. Write the full length.

RESPONSE FORMAT — return ONLY valid JSON, no code fences:
{
  "title": "Compelling, specific headline under 70 characters",
  "slug": "url-friendly-slug",
  "summary": "One or two sentences for search results and cards, under 200 characters",
  "content": "<h2>...</h2><p>...</p><h3>1. ...</h3><p>...</p>",
  "verdict": "<p>2-3 sentences naming your top pick and a runner-up for a different kind of reader.</p>"
}`

function formatBreeds(breeds: RoundupBreed[]): string {
  return breeds
    .map((b, i) => {
      const traits = b.traits
        ? Object.entries(b.traits)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : 'no ratings'
      return `${i + 1}. ${b.name} | ${b.size ?? 'medium'} | ${b.breedGroup ?? '—'} | bred for ${b.breedRole ?? 'companionship'} | ${traits}`
    })
    .join('\n')
}

export async function generateRoundupWithGrok(
  opts: {
    /** e.g. "apartment living" */
    angleLabel: string
    /** One line describing the reader. */
    intent: string
    breeds: RoundupBreed[]
    /** Set for group roundups instead of a lifestyle angle. */
    breedGroup?: string
  },
): Promise<GeneratedRoundup> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY environment variable is not set')
  if (opts.breeds.length < 3) throw new Error('A roundup needs at least 3 breeds')

  const framing = opts.breedGroup
    ? `TOPIC: every notable breed in the ${opts.breedGroup} group, ranked for everyday family life.`
    : `TOPIC: the best dogs for ${opts.angleLabel}.`

  const userPrompt = `${framing}

WHO IS READING THIS:
${opts.intent}

SHORTLIST — rank these, and use only these. Trait values are 1-10 and are for your reasoning only; never print them.
${formatBreeds(opts.breeds)}

Rank them for this specific reader. Lead with the strongest fit. Give every breed its honest downside.`

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.75,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(180000),
  })

  if (!response.ok) {
    throw new Error(`Grok API error (${response.status}): ${(await response.text()).slice(0, 300)}`)
  }

  const data = await response.json()
  const content: string | undefined = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Grok returned an empty response')

  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(jsonStr) as Partial<GeneratedRoundup>
  if (!parsed.title || !parsed.content) {
    throw new Error('Grok response was missing a title or content')
  }

  // Strip any trait notation that slipped through despite the instruction.
  const scrub = (s: string) =>
    s
      .replace(/\b(?:scores?|rated|rating of)\s+\d{1,2}\s*\/\s*10\b/gi, '')
      .replace(/\b[a-zA-Z]+Level\s*=\s*\d{1,2}\b/g, '')
      .replace(/\s{2,}/g, ' ')

  return {
    title: parsed.title.slice(0, 160),
    slug:
      (parsed.slug || parsed.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90) || 'roundup',
    summary: scrub(parsed.summary ?? '').slice(0, 400),
    content: scrub(parsed.content),
    verdict: scrub(parsed.verdict ?? ''),
  }
}
