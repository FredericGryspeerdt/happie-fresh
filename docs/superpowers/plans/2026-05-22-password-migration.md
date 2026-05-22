# Password Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `UserRepo.updatePasswordHash` method and a `scripts/migrate.ts`
script that upgrades legacy SHA-256 password hashes to PBKDF2 using
`SEED_PASSWORD` from env.

**Architecture:** `UserRepo` gains a single method that atomically updates
`passwordHash` on both KV indexes. The migration script iterates all users,
detects legacy hashes by regex, verifies against `SEED_PASSWORD` via inline
SHA-256, re-hashes with PBKDF2, and calls the repo method. Idempotent —
already-migrated users are counted and skipped.

**Tech Stack:** Deno, Deno KV, Web Crypto API (`crypto.subtle.digest`,
`crypto.subtle.deriveBits`), `@/utils/index.ts` (for `hashPassword`).

---

## File Map

| Action | Path                    | Responsibility                  |
| ------ | ----------------------- | ------------------------------- |
| Modify | `database/user.repo.ts` | Add `updatePasswordHash` method |
| Create | `scripts/migrate.ts`    | One-time migration script       |

---

## Task 1: Add `UserRepo.updatePasswordHash`

**Files:**

- Modify: `database/user.repo.ts`

### Background

`database/user.repo.ts` stores users under two KV keys that must stay in sync:

- `["users", id]` — lookup by ID
- `["users_by_username", username]` — lookup by username

Both must be updated atomically when `passwordHash` changes. The pattern mirrors
`UserRepo.create` which also writes both keys in one `atomic()` call.

`getKv()` is imported from `./db.ts` and returns a singleton `Deno.Kv` instance.
Use `kv.get<UserInterface>(["users", userId])` to fetch by ID.

- [ ] **Step 1: Add `updatePasswordHash` to `UserRepo`**

  Open `database/user.repo.ts` and add this method inside the `UserRepo` class,
  after `create`:

  ```ts
  static async updatePasswordHash(
    userId: string,
    username: string,
    newHash: string,
  ): Promise<void> {
    const kv = await getKv();
    const entry = await kv.get<UserInterface>(["users", userId]);
    if (!entry.value) {
      throw new Error(`User not found: ${userId}`);
    }
    const updated = { ...entry.value, passwordHash: newHash };
    await kv
      .atomic()
      .set(["users", userId], updated)
      .set(["users_by_username", username], updated)
      .commit();
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  deno check database/user.repo.ts
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add database/user.repo.ts
  git commit -m "feat(user-repo): add updatePasswordHash method"
  ```

---

## Task 2: Create `scripts/migrate.ts`

**Files:**

- Create: `scripts/migrate.ts`

### Background

The migration script must:

1. Read `SEED_PASSWORD` from env (crashes with a clear message if missing)
2. List all users under the `["users"]` KV prefix
3. For each user:
   - If hash doesn't match `/^[0-9a-f]{64}$/` → already on PBKDF2, count and
     skip
   - If hash matches the regex → legacy SHA-256 user: a. Compute SHA-256 of
     `SEED_PASSWORD` inline and compare to stored hash b. If mismatch → warn and
     skip (do NOT overwrite with a wrong password) c. If match → call
     `hashPassword(SEED_PASSWORD)` for a fresh PBKDF2 hash, then
     `UserRepo.updatePasswordHash(...)`
4. Print per-user result and a final summary

`hashPassword` is imported from `@/utils/index.ts`. `UserRepo` is imported from
`@/database/user.repo.ts`. `getKv` is imported from `@/database/db.ts`.

- [ ] **Step 1: Create `scripts/migrate.ts`**

  ```ts
  // scripts/migrate.ts
  import { UserRepo } from "@/database/user.repo.ts";
  import { getKv } from "@/database/db.ts";
  import { hashPassword } from "@/utils/index.ts";
  import { UserInterface } from "@/models/index.ts";

  function isLegacyHash(hash: string): boolean {
    return /^[0-9a-f]{64}$/.test(hash);
  }

  async function sha256Hex(password: string): Promise<string> {
    const data = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function migrate() {
    const password = Deno.env.get("SEED_PASSWORD");
    if (!password) {
      console.error("❌ SEED_PASSWORD env var is required.");
      Deno.exit(1);
    }

    const kv = await getKv();
    let migrated = 0;
    let skippedMismatch = 0;
    let alreadyMigrated = 0;

    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      if (!user) continue;

      if (!isLegacyHash(user.passwordHash)) {
        alreadyMigrated++;
        continue;
      }

      const legacyHash = await sha256Hex(password);
      if (user.passwordHash !== legacyHash) {
        console.warn(
          `⚠️  Skipped '${user.username}' — stored hash does not match SEED_PASSWORD.`,
        );
        skippedMismatch++;
        continue;
      }

      const newHash = await hashPassword(password);
      await UserRepo.updatePasswordHash(user.id, user.username, newHash);
      console.log(`✅ Migrated '${user.username}'`);
      migrated++;
    }

    console.log(
      `\nDone. ${migrated} migrated, ${skippedMismatch} skipped (password mismatch), ${alreadyMigrated} already on PBKDF2.`,
    );
    kv.close();
  }

  if (import.meta.main) {
    migrate().catch((err) => {
      console.error("Migration failed:", err);
      Deno.exit(1);
    });
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  deno check scripts/migrate.ts
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add scripts/migrate.ts
  git commit -m "feat(scripts): add SHA-256 to PBKDF2 password migration script"
  ```

---

## Task 3: Smoke-test the migration

**Files:** none modified

- [ ] **Step 1: Verify `deno task check` passes**

  ```bash
  deno task check
  ```

  Expected: format, lint, and type checks all pass (pre-existing errors in
  `models/item/item.model.ts` are acceptable — they are unrelated to this work).

- [ ] **Step 2: Run the migration against the local KV store**

  Ensure `.env` contains the correct `SEED_PASSWORD` for the existing seeded
  user, then:

  ```bash
  deno task db:migrate
  ```

  Expected output (if user has a legacy SHA-256 hash):
  ```
  ✅ Migrated 'admin'

  Done. 1 migrated, 0 skipped (password mismatch), 0 already on PBKDF2.
  ```

  Expected output (if run a second time — idempotency check):
  ```
  Done. 0 migrated, 0 skipped (password mismatch), 1 already on PBKDF2.
  ```

- [ ] **Step 3: Verify login works**

  Start the dev server:
  ```bash
  deno task dev
  ```

  Navigate to `http://localhost:8000/login` and log in with the credentials from
  `.env`. Confirm you reach the home page without errors.
