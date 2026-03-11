import type { CollectionAfterChangeHook } from 'payload'

/**
 * Triggers a Cloudflare Pages redeploy via GitHub repository_dispatch
 * whenever a Product is created or updated.
 *
 * Requires environment variables:
 *   GITHUB_DEPLOY_TOKEN  - GitHub PAT with repo scope
 *   GITHUB_REPO          - e.g. "your-username/pet"
 */
export const triggerRedeploy: CollectionAfterChangeHook = async ({ doc, operation }) => {
  const token = process.env.GITHUB_DEPLOY_TOKEN
  const repo = process.env.GITHUB_REPO

  if (!token || !repo) {
    console.warn('[redeploy] GITHUB_DEPLOY_TOKEN or GITHUB_REPO not set, skipping redeploy trigger')
    return doc
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'payload-cms-update',
        client_payload: {
          collection: 'products',
          operation,
          id: doc.id,
          name: doc.name,
          slug: doc.slug,
        },
      }),
    })

    if (res.ok) {
      console.log(`[redeploy] Triggered for ${operation} on product: ${doc.name}`)
    } else {
      console.error(`[redeploy] GitHub API error: ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    console.error('[redeploy] Failed to trigger redeploy:', err)
  }

  return doc
}
