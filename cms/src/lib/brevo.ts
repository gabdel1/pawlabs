/**
 * Brevo contact subscription, shared by the newsletter endpoint and the
 * Breed Match quiz.
 */

export interface SubscribeResult {
  ok: boolean
  existing?: boolean
  /** Message safe to show a visitor. */
  error?: string
  /** Suggested HTTP status when surfacing this as a response. */
  status: number
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.length <= 254
}

export async function subscribeToBrevo(
  email: string,
  attributes: Record<string, string> = {},
): Promise<SubscribeResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Email service not configured', status: 500 }
  }

  const normalized = email.trim().toLowerCase()
  if (!isValidEmail(normalized)) {
    return { ok: false, error: 'A valid email address is required', status: 400 }
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: normalized, attributes, updateEnabled: true }),
      signal: AbortSignal.timeout(10000),
    })

    if (res.status === 201 || res.status === 204) {
      return { ok: true, status: 200 }
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (
      res.status === 400 &&
      typeof data.message === 'string' &&
      data.message.toLowerCase().includes('already exist')
    ) {
      return { ok: true, existing: true, status: 200 }
    }

    console.error('[brevo] Subscribe error:', res.status, data)
    return { ok: false, error: 'Subscription failed. Please try again.', status: 502 }
  } catch (err) {
    console.error('[brevo] Network error:', err)
    return { ok: false, error: 'Service unavailable. Please try again later.', status: 503 }
  }
}
