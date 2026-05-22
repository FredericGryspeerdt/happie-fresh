# Design: PBKDF2 Password Hashing

**Date:** 2026-05-20 **Status:** Approved **Fixes:** Security Vuln 1 (unsalted
SHA-256 password storage) and Vuln 2 (plaintext password in seed log)

## Background

Passwords are currently hashed with plain SHA-256 and no salt
(`utils/security.ts`). This makes stored hashes trivially crackable via rainbow
tables or GPU brute-force. The fix replaces SHA-256 with PBKDF2-SHA-256 using a
random per-password salt, using only Deno's built-in Web Crypto API (no new
dependencies).

## Changes

### `utils/security.ts`

Replace the single `hashPassword` function with two exported functions.

**`hashPassword(password: string): Promise<string>`**

- Generates a cryptographically random 16-byte salt via `crypto.getRandomValues`
- Derives a 32-byte key with `crypto.subtle.deriveKey` using PBKDF2-SHA-256 at
  310,000 iterations (NIST SP 800-132 minimum)
- Returns a PHC-style self-describing format string:
  ```
  $pbkdf2-sha256$310000$<base64url-salt>$<base64url-hash>
  ```

**`verifyPassword(password: string, stored: string): Promise<boolean>`**

- Parses the stored format string to extract algorithm, iterations, salt, and
  hash
- Re-derives the key with the same parameters
- Compares using `crypto.subtle.timingSafeEqual` for a constant-time comparison

The `hashPassword` signature is unchanged, so `seed.ts` needs no change beyond
the log fix.

### `routes/login.tsx`

Replace the two-step hash-then-compare pattern:

```ts
// Before
const passwordHash = await hashPassword(password);
if (user.passwordHash !== passwordHash) { ... }

// After
const valid = await verifyPassword(password, user.passwordHash);
if (!valid) { ... }
```

Import `verifyPassword` alongside the existing `hashPassword` import.

### `scripts/seed.ts`

Remove the plaintext password from the completion log line:

```ts
// Before
console.log(
  `✅ Seed complete. Created user '${username}' with password '${password}'.`,
);

// After
console.log(`✅ Seed complete. Created user '${username}'.`);
```

### `utils/security_test.ts` (new file)

Unit tests covering:

1. `hashPassword` output starts with `$pbkdf2-sha256$`
2. `verifyPassword` returns `true` for the correct password
3. `verifyPassword` returns `false` for a wrong password
4. Two `hashPassword` calls with the same input produce different strings (salt
   randomness)

## Data Model

`UserInterface.passwordHash: string` is unchanged. The format string is
self-describing, so no schema migration is needed.

## Migration

The existing seeded user has a 64-char hex SHA-256 hash that `verifyPassword`
will not recognise (it lacks the `$pbkdf2-sha256$` prefix). Migration steps:

1. Open the KV store: `deno task db:view`
2. Delete the existing user record (or run `UserRepo.deleteAll()` in a one-off
   script)
3. Re-seed: `deno task db:seed`

Alternatively, add a `deno task db:reset` convenience task that calls
`UserRepo.deleteAll()` then seeds.

## Out of Scope

- Algorithm upgrade to Argon2id (no Deno built-in; adds a dependency)
- Multi-tenant ownership checks
- CSRF token implementation
- `httpOnly` cookie flag (defence-in-depth; no confirmed XSS vector)
