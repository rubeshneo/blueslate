// Single source of truth for who is a Blueslate admin.
// Override with the ADMIN_EMAIL env var; defaults to the product owner.
// Comparison is case-insensitive so casing differences never lock the admin out.

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'rubesh.kumar@neoaistriq.com').toLowerCase()

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL
}
