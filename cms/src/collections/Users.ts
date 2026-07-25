import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    // Keep admins logged in effectively forever (10 years).
    // Payload's default is 7200s (2h), which logs you out after inactivity.
    // This governs both the JWT/cookie lifetime and the session record expiry,
    // and is refreshed on activity, so the admin panel won't log out on idle.
    tokenExpiration: 60 * 60 * 24 * 365 * 10,
  },
  fields: [],
}
