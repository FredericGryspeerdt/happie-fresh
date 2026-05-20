# PBKDF2 Password Hashing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unsalted SHA-256 password hashing with PBKDF2-SHA-256 (salted, 310k iterations) using only Deno's built-in Web Crypto API, and fix a plaintext password log in the seed script.

**Architecture:** `utils/security.ts` gains a `verifyPassword` function alongside the updated `hashPassword`. The stored format is a self-describing PHC-style string (`$pbkdf2-sha256$310000$<base64url-salt>$<base64url-hash>`) so no schema changes are needed. The login route swaps its two-step hash-then-compare for a single `verifyPassword` call.

**Tech Stack:** Deno, Web Crypto API (`crypto.subtle.importKey`, `crypto.subtle.deriveBits`, `crypto.subtle.timingSafeEqual`), Fresh 2, Deno KV.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `utils/security.ts` | Replace SHA-256 hash with PBKDF2 `hashPassword` + new `verifyPassword` |
| Create | `utils/security_test.ts` | Unit tests for both functions |
| Modify | `routes/login.tsx` | Use `verifyPassword` instead of hash-then-compare |
| Modify | `scripts/seed.ts` | Remove plaintext password from log line |

---

## Task 1: Rewrite `utils/security.ts` with PBKDF2

**Files:**
- Modify: `utils/security.ts`

### Background

`crypto.subtle` in Deno's Web Crypto API supports PBKDF2 natively. The approach:
1. Generate a 16-byte random salt.
2. Import the password as a `CryptoKey` with `importKey("raw", ..., "PBKDF2", false, ["deriveBits"])`.
3. Call `deriveBits` with `{ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }` to get 256 bits (32 bytes).
4. Base64url-encode both salt and derived bits, concatenate into a PHC-style string.

`verifyPassword` reverses the process: parse the stored string, re-derive, compare with `timingSafeEqual`.

- [ ] **Step 1: Replace `utils/security.ts` with the new implementation**

  The complete new file:

  ```ts
  const ITERATIONS = 310_000;
  const HASH = "SHA-256";
  const KEY_LEN_BITS = 256;
  const PREFIX = "$pbkdf2-sha256$";

  function toBase64url(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function fromBase64url(s: string): Uint8Array {
    const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(base64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<ArrayBuffer> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    return crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: HASH, salt, iterations },
      keyMaterial,
      KEY_LEN_BITS,
    );
  }

  export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await deriveKey(password, salt, ITERATIONS);
    return `${PREFIX}${ITERATIONS}$${toBase64url(salt)}$${toBase64url(derived)}`;
  }

  export async function verifyPassword(
    password: string,
    stored: string,
  ): Promise<boolean> {
    if (!stored.startsWith(PREFIX)) return false;
    const parts = stored.split("$");
    // parts: ["", "pbkdf2-sha256", iterations, salt, hash]
    if (parts.length !== 5) return false;
    const iterations = parseInt(parts[2], 10);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    const salt = fromBase64url(parts[3]);
    const expectedHash = fromBase64url(parts[4]);
    const derived = await deriveKey(password, salt, iterations);
    const derivedArr = new Uint8Array(derived);
    if (derivedArr.length !== expectedHash.length) return false;
    return crypto.subtle.timingSafeEqual(derivedArr, expectedHash);
  }
  ```

- [ ] **Step 2: Verify the file type-checks**

  ```bash
  deno check utils/security.ts
  ```

  Expected: no errors.

---

## Task 2: Write and run unit tests

**Files:**
- Create: `utils/security_test.ts`

- [ ] **Step 1: Create `utils/security_test.ts`**

  ```ts
  import { assertEquals, assertNotEquals } from "$std/assert/mod.ts";
  import { hashPassword, verifyPassword } from "@/utils/security.ts";

  Deno.test("hashPassword produces PHC-style prefix", async () => {
    const hash = await hashPassword("hunter2");
    assertEquals(hash.startsWith("$pbkdf2-sha256$310000$"), true);
  });

  Deno.test("hashPassword produces different hashes for same input (salt randomness)", async () => {
    const h1 = await hashPassword("hunter2");
    const h2 = await hashPassword("hunter2");
    assertNotEquals(h1, h2);
  });

  Deno.test("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("correct-horse-battery-staple", hash);
    assertEquals(result, true);
  });

  Deno.test("verifyPassword returns false for wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("wrong-password", hash);
    assertEquals(result, false);
  });

  Deno.test("verifyPassword returns false for legacy SHA-256 hex string", async () => {
    const legacySha256 = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    const result = await verifyPassword("admin", legacySha256);
    assertEquals(result, false);
  });
  ```

- [ ] **Step 2: Run the tests and verify they all pass**

  ```bash
  deno test utils/security_test.ts --unstable-kv
  ```

  Expected: 5 tests pass. Note: PBKDF2 at 310k iterations takes ~200ms per hash, so the test suite will take a few seconds — this is expected.

- [ ] **Step 3: Commit**

  ```bash
  git add utils/security.ts utils/security_test.ts
  git commit -m "feat(security): replace SHA-256 with PBKDF2-SHA-256 password hashing"
  ```

---

## Task 3: Update `routes/login.tsx` to use `verifyPassword`

**Files:**
- Modify: `routes/login.tsx`

- [ ] **Step 1: Update the import line**

  Find line 4 in `routes/login.tsx`:
  ```ts
  import { define, hashPassword } from "@/utils/index.ts";
  ```
  Replace with:
  ```ts
  import { define, verifyPassword } from "@/utils/index.ts";
  ```

- [ ] **Step 2: Replace the hash-then-compare block**

  Find lines 29–32:
  ```ts
  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    return page({ error: "Ongeldige inloggegevens." });
  }
  ```
  Replace with:
  ```ts
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return page({ error: "Ongeldige inloggegevens." });
  }
  ```

- [ ] **Step 3: Type-check the route**

  ```bash
  deno check routes/login.tsx
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add routes/login.tsx
  git commit -m "fix(auth): use verifyPassword in login handler"
  ```

---

## Task 4: Fix plaintext password log in `scripts/seed.ts`

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Remove password from the log line**

  Find line 29–31 in `scripts/seed.ts`:
  ```ts
  console.log(
    `✅ Seed complete. Created user '${username}' with password '${password}'.`,
  );
  ```
  Replace with:
  ```ts
  console.log(`✅ Seed complete. Created user '${username}'.`);
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/seed.ts
  git commit -m "fix(seed): remove plaintext password from log output"
  ```

---

## Task 5: Full check and migration

**Files:** none modified

- [ ] **Step 1: Run the full check suite**

  ```bash
  deno task check
  ```

  Expected: format check, lint, and type check all pass with no errors.

- [ ] **Step 2: Run all tests**

  ```bash
  deno test --unstable-kv
  ```

  Expected: all tests pass.

- [ ] **Step 3: Migrate the existing user**

  The existing seeded user in Deno KV has a 64-char hex SHA-256 hash. `verifyPassword` will reject it (no `$pbkdf2-sha256$` prefix), so login will fail until the user is re-seeded.

  Delete the old user and re-seed:
  ```bash
  deno task db:view   # confirm the username of the existing user
  deno run --env-file --unstable-kv -A -e "
    import { UserRepo } from './database/user.repo.ts';
    await UserRepo.deleteAll();
    console.log('Users deleted.');
  "
  deno task db:seed
  ```

  Alternatively, if you prefer a single command, add this task to `deno.json`:
  ```json
  "db:reset": "deno run --env-file --unstable-kv -A scripts/reset.ts"
  ```
  and create `scripts/reset.ts`:
  ```ts
  import { UserRepo } from "@/database/user.repo.ts";
  import { getKv } from "@/database/db.ts";

  const kv = await getKv();
  await UserRepo.deleteAll();
  console.log("✅ All users deleted.");
  kv.close();
  ```
  Then run `deno task db:reset && deno task db:seed`.

- [ ] **Step 4: Smoke-test login manually**

  Start the dev server:
  ```bash
  deno task dev
  ```
  Navigate to `http://localhost:8000/login`, log in with the credentials from `.env`. Confirm you reach the home page without errors.
