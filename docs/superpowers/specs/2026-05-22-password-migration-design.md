# Design: SHA-256 → PBKDF2 Password Migration

**Date:** 2026-05-22 **Status:** Approved

## Background

After replacing unsalted SHA-256 with PBKDF2-SHA-256, existing users in Deno KV
still have old SHA-256 hashes. `verifyPassword` rejects them (no
`$pbkdf2-sha256$` prefix), so those users cannot log in until their hash is
upgraded. This migration script re-hashes affected accounts using the plaintext
password from `SEED_PASSWORD`.

## Changes

### `database/user.repo.ts` — add `updatePasswordHash`

New method:

```ts
static async updatePasswordHash(
  userId: string,
  username: string,
  newHash: string,
): Promise<void>
```

- Fetches the full user record by ID
- Throws if user not found
- Atomically writes `{ ...user, passwordHash: newHash }` to both KV entries:
  - `["users", userId]`
  - `["users_by_username", username]`

This keeps both indexes in sync, matching the pattern established in
`UserRepo.create`.

### `scripts/migrate.ts` — new migration script

Run via `deno task db:migrate`. Reads `SEED_PASSWORD` from env.

**Algorithm:**

1. List all entries under `["users"]` prefix in KV
2. For each user, check if `passwordHash` matches the legacy format:
   `/^[0-9a-f]{64}$/` (64 lowercase hex chars, no `$pbkdf2` prefix)
3. Skip users already on PBKDF2 (count as "already migrated")
4. For legacy users: a. Compute SHA-256 hash of `SEED_PASSWORD` inline (via
   `crypto.subtle.digest`) — no import of old utility needed b. Compare against
   stored hash; if mismatch, print warning and skip (avoids corrupting an
   account whose password differs from the env var) c. On match: call
   `hashPassword(SEED_PASSWORD)` to produce a PBKDF2 hash d. Call
   `UserRepo.updatePasswordHash(userId, username, newHash)` e. Print
   `✅ Migrated 'username'`
5. Print summary:
   `N migrated, M skipped (password mismatch), K already on PBKDF2`

**Legacy SHA-256 detection:**

```ts
function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}
```

**Inline SHA-256 for verification:**

```ts
async function sha256Hex(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### `deno.json`

`db:migrate` task already present, pointing to `scripts/migrate.ts`. No changes
needed.

## Data Safety

- `updatePasswordHash` fetches the full record before writing, so all other
  fields (including `householdId`) are preserved
- If `SEED_PASSWORD` doesn't match a stored legacy hash, the account is skipped
  with a warning — never silently corrupted
- The script is idempotent: running it twice skips already-migrated users

## Testing

No automated tests. The migration runs against a live KV store; correctness is
verified by:

1. Running `deno task db:migrate` and confirming `✅ Migrated` output
2. Logging in successfully after migration

## Out of Scope

- Migrating users whose password differs from `SEED_PASSWORD` (no mechanism to
  know their password)
- Interactive password prompting
- Rollback (original hashes are overwritten; re-seed if needed)
