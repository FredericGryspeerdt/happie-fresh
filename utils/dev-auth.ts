// Dev-only auto-login decision. In local development the app can act as a
// seeded user without a login round-trip. This is a pure decision so it can be
// unit-tested; the middleware wires it to real env vars and a user lookup.
//
// It never applies in production: on Deno Deploy `DENO_DEPLOYMENT_ID` is always
// set (the same signal `database/db.ts` and the seed script rely on).
//
// ASSUMPTION: the only production target is Deno Deploy. Auto-login is on by
// default in dev and gated purely on the *absence* of `DENO_DEPLOYMENT_ID`. If
// this app is ever self-hosted somewhere that does not set that variable (e.g.
// a Docker/VPS deployment), this default would become an auth bypass and MUST
// be revisited — e.g. require an explicit positive dev signal instead.

const DEFAULT_DEV_USERNAME = "demo";

/**
 * Returns the username the dev server should auto-authenticate as, or `null`
 * when auto-login must not apply.
 *
 * @param deploymentId value of `DENO_DEPLOYMENT_ID` (set in production)
 * @param autoLoginFlag value of `DEV_AUTOLOGIN` (`"false"` disables it)
 * @param seedUsername value of `SEED_USERNAME` (overrides the default user)
 */
export function devAutoLoginUsername(
  deploymentId: string | undefined,
  autoLoginFlag: string | undefined,
  seedUsername: string | undefined,
): string | null {
  if (deploymentId) return null; // production — never auto-login
  if (autoLoginFlag?.toLowerCase() === "false") return null; // explicitly disabled
  return seedUsername || DEFAULT_DEV_USERNAME;
}
