import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

/**
 * Shared-secret auth for machine-facing endpoints.
 *
 * Fails closed: if the environment variable is unset or blank the endpoint is
 * unusable rather than open. That matters more than it sounds — the naive
 * `provided === process.env.KEY` check passes when both sides are `undefined`,
 * which turns a missing config value into an open door.
 *
 * Comparison is timing-safe. Both sides are hashed first so the compare runs
 * over equal-length buffers regardless of what the caller sent.
 */

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Pull the key from the JSON body, or from a header if the caller prefers. */
export function extractApiKey(req: NextRequest, body: Record<string, unknown>): string | null {
  const fromBody = typeof body?.key === 'string' ? body.key : null
  if (fromBody) return fromBody

  const header = req.headers.get('x-api-key')
  if (header) return header

  const auth = req.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()

  return null
}

export function verifyApiKey(provided: string | null, envVar: string): AuthResult {
  const expected = process.env[envVar]

  if (!expected || expected.trim().length === 0) {
    console.error(`[api-key] ${envVar} is not configured — refusing the request`)
    return {
      ok: false,
      status: 503,
      error: 'This endpoint is not configured on the server.',
    }
  }

  if (!provided) {
    return { ok: false, status: 401, error: 'Missing API key.' }
  }

  if (!timingSafeEqual(sha256(provided), sha256(expected))) {
    return { ok: false, status: 401, error: 'Invalid API key.' }
  }

  return { ok: true }
}

/**
 * Simple in-memory sliding window, per key-holder+IP.
 * Resets on restart, which is fine — it exists to cap runaway cost, not to be
 * an audited quota.
 */
const hits = new Map<string, number[]>()

export function rateLimit(bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(bucket) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(bucket, recent)

  if (hits.size > 2000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }

  return recent.length > max
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
