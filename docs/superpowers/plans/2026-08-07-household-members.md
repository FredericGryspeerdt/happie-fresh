# Household Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #17 — households are made of credential-less **members** (Netflix model); managers manage members and destructive actions; every request acts as a claimed member.

**Architecture:** A new `Member` entity (`["members", householdId, id]` in Deno KV) sits beside the existing `User` (which stays a pure login credential and gains a `memberId` link). The auth middleware resolves an **acting member** per request from an `actingMemberId` cookie (falling back to the login's linked member) and exposes it on `ctx.state`. Attribution (`createdBy`) switches from user ids to member ids (one-shot migration rewrites old rows). Six destructive endpoints get a manager-only gate. UI: a `/members` management page, an avatar-chip switcher in the top app bar, and hidden destructive affordances for non-managers.

**Tech Stack:** Deno + Fresh 2 (SSR + islands), Preact + @preact/signals, Deno KV, Tailwind v4, MD3 component library (`components/md3/`).

**Design authority:** ADR 0006 (`docs/adr/0006-members-are-people-users-are-credentials.md`) and the glossary (`CONTEXT.md` — *Member*, *Manager*). The grilled decisions: two tiers only; honor system (guardrail, not lock) with a PIN-ready model; pick-once-per-device switching; minimal member fields (**no age/birthdate**); hard delete with graceful dangling attribution; last-manager demote/remove rejected; manager gating of existing deletes ships in this iteration.

## Global Constraints

- `deno task check` (fmt + lint + type check) and `deno task test` must pass after every task.
- Preact JSX: `class`, never `className`. Imports use the `@/` alias.
- Commits follow Conventional Commits (`feat:`, `fix(scope):`, …).
- Domain language per `CONTEXT.md`: "member" and "manager" — never "profile", "user", "account", "admin", "owner" in user-facing copy or domain-level identifiers.
- UI must follow `docs/ui-ux-patterns.md`: MD3 components + tokens (§9), api-service error boundary returning `null`/`[]` (§2), snackbar on failure + rollback (§3), pessimistic creates / optimistic updates-deletes (§1), `useSignal` in component bodies (§8), confirmations are bottom Sheets, not dialogs (§9).
- When unsure of a Fresh 2 API, consult Context7 (`resolve-library-id` → `query-docs`) before writing code — do not guess from training data.
- Repo tests use the in-memory KV pattern: `Deno.env.set("KV_PATH", ":memory:")` at module top, `sanitizeResources: false`, distinct `householdId` per test (see `database/todo.repo.test.ts:1-17`).
- Run a single test file with: `deno test --unstable-kv -A <path>`.

---

### Task 1: Member model, avatar presets, and MemberRepo

**Files:**
- Create: `models/member/member.interface.ts`
- Create: `models/member/avatar.ts`
- Create: `models/member/index.ts`
- Modify: `models/index.ts`
- Create: `database/member.repo.ts`
- Modify: `database/index.ts`
- Test: `database/member.repo.test.ts`

**Interfaces:**
- Consumes: `getKv` from `database/db.ts`, `mergeDefinedPatch` from `database/merge-patch.ts`.
- Produces (used by every later task):
  - `MemberInterface { id: string; householdId: string; name: string; color: string; emoji: string; isManager: boolean }`
  - `CreateMemberDto = Omit<MemberInterface, "id">`
  - `UpdateMemberDto = Partial<Omit<MemberInterface, "id" | "householdId">>`
  - `MemberInput = Pick<MemberInterface, "name" | "color" | "emoji"> & { isManager?: boolean }`
  - `AVATAR_COLORS`, `DEFAULT_AVATAR_COLOR`, `AVATAR_EMOJIS`, `DEFAULT_AVATAR_EMOJI`, `resolveAvatarColor(key?)`, `isAvatarColor(key)`
  - `MemberRepo.create(data: CreateMemberDto): Promise<MemberInterface>`
  - `MemberRepo.getAll(householdId: string): Promise<MemberInterface[]>` — name-ascending (`localeCompare`)
  - `MemberRepo.getById(householdId: string, id: string): Promise<MemberInterface | null>`
  - `MemberRepo.update(householdId: string, id: string, patch: UpdateMemberDto): Promise<MemberInterface | null>`
  - `MemberRepo.delete(householdId: string, id: string): Promise<void>`
  - `MemberRepo.countManagers(householdId: string): Promise<number>`

- [ ] **Step 1: Write the model files**

`models/member/member.interface.ts`:

```ts
export interface MemberInterface {
  id: string;
  householdId: string;
  /** What the household calls them — a first name or nickname ("Mama", "Bo"). */
  name: string;
  /** Preset avatar colour key — one of AVATAR_COLORS (see ./avatar.ts). */
  color: string;
  /** Preset avatar emoji glyph. */
  emoji: string;
  /**
   * A manager is a member the household trusts with the sharp knives:
   * managing members and destroying household data. A household always has
   * at least one. Deliberately a boolean, not a role enum — and deliberately
   * no age or birthdate (data minimisation for minors). See docs/adr/0006.
   */
  isManager: boolean;
}

// Derived type for creation (no ID — the server mints it).
export type CreateMemberDto = Omit<MemberInterface, "id">;

// Patch/update: never the id or householdId, everything else optional.
export type UpdateMemberDto = Partial<Omit<MemberInterface, "id" | "householdId">>;

/**
 * What the client sends to create a member. The server fills in `householdId`
 * and `id` — the client never sends (and cannot spoof) the household.
 */
export type MemberInput = Pick<MemberInterface, "name" | "color" | "emoji"> & {
  isManager?: boolean;
};
```

`models/member/avatar.ts` (mirrors `components/cards/palette.ts` idiom):

```ts
/**
 * Preset avatars for members: a colour + an emoji, no uploads. Deliberately
 * data-light and kid-friendly; deliberately not tied to MD3 tokens so members
 * stay visually distinct from app chrome.
 */
export interface AvatarColor {
  key: string;
  bg: string;
  fg: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { key: "coral", bg: "#E76F51", fg: "#FFFFFF" },
  { key: "sunshine", bg: "#F2B705", fg: "#5C4500" },
  { key: "meadow", bg: "#2A9D8F", fg: "#FFFFFF" },
  { key: "sky", bg: "#3D7DD8", fg: "#FFFFFF" },
  { key: "lavender", bg: "#8367C7", fg: "#FFFFFF" },
  { key: "flamingo", bg: "#E05780", fg: "#FFFFFF" },
  { key: "mint", bg: "#7BC950", fg: "#1F3D0C" },
  { key: "slate", bg: "#52616B", fg: "#FFFFFF" },
];

export const DEFAULT_AVATAR_COLOR = "sky";

export const AVATAR_EMOJIS = [
  "🙂", "🦊", "🐸", "🐼", "🦄", "🐙", "🦖", "🐝",
  "🌻", "⭐", "🍀", "🚀", "⚽", "🎨", "🎸", "🧢",
];

export const DEFAULT_AVATAR_EMOJI = "🙂";

/** Resolve a stored colour key to its swatch, falling back to the default. */
export function resolveAvatarColor(key?: string): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ??
    AVATAR_COLORS.find((c) => c.key === DEFAULT_AVATAR_COLOR)!;
}

/** True when `key` names a preset colour (server-side validation). */
export function isAvatarColor(key: unknown): key is string {
  return typeof key === "string" && AVATAR_COLORS.some((c) => c.key === key);
}
```

`models/member/index.ts`:

```ts
export * from "./member.interface.ts";
export * from "./avatar.ts";
```

Add to `models/index.ts` (after the household line):

```ts
export * from "./member/index.ts";
```

- [ ] **Step 2: Write the failing repo test**

`database/member.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { MemberRepo } from "@/database/member.repo.ts";
import type { CreateMemberDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see todo.repo.test.ts for why
// module-load is early enough and why sanitizeResources is disabled).
Deno.env.set("KV_PATH", ":memory:");

function draft(
  householdId: string,
  name: string,
  overrides: Partial<CreateMemberDto> = {},
): CreateMemberDto {
  return {
    householdId,
    name,
    color: "sky",
    emoji: "🙂",
    isManager: false,
    ...overrides,
  };
}

Deno.test({
  name: "create — mints an id and stores the member",
  sanitizeResources: false,
  async fn() {
    const member = await MemberRepo.create(draft("hh-create", "Bo"));
    assertEquals(member.name, "Bo");
    assertEquals(typeof member.id, "string");
    assertEquals(member.id.length > 0, true);
    const found = await MemberRepo.getById("hh-create", member.id);
    assertEquals(found?.id, member.id);
  },
});

Deno.test({
  name: "getAll — scoped to the household, sorted by name",
  sanitizeResources: false,
  async fn() {
    await MemberRepo.create(draft("hh-all", "Robin"));
    await MemberRepo.create(draft("hh-all", "Alex"));
    await MemberRepo.create(draft("hh-other", "Sam"));
    const members = await MemberRepo.getAll("hh-all");
    assertEquals(members.map((m) => m.name), ["Alex", "Robin"]);
  },
});

Deno.test({
  name: "update — merges defined fields only",
  sanitizeResources: false,
  async fn() {
    const m = await MemberRepo.create(draft("hh-upd", "Bo"));
    const updated = await MemberRepo.update("hh-upd", m.id, { emoji: "🐸" });
    assertEquals(updated?.emoji, "🐸");
    assertEquals(updated?.name, "Bo");
    assertEquals(await MemberRepo.update("hh-upd", "nope", { name: "X" }), null);
  },
});

Deno.test({
  name: "delete — removes the member",
  sanitizeResources: false,
  async fn() {
    const m = await MemberRepo.create(draft("hh-del", "Bo"));
    await MemberRepo.delete("hh-del", m.id);
    assertEquals(await MemberRepo.getById("hh-del", m.id), null);
  },
});

Deno.test({
  name: "countManagers — counts only managers in the household",
  sanitizeResources: false,
  async fn() {
    await MemberRepo.create(draft("hh-count", "Alex", { isManager: true }));
    await MemberRepo.create(draft("hh-count", "Robin", { isManager: true }));
    await MemberRepo.create(draft("hh-count", "Bo"));
    await MemberRepo.create(draft("hh-elsewhere", "Sam", { isManager: true }));
    assertEquals(await MemberRepo.countManagers("hh-count"), 2);
  },
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `deno test --unstable-kv -A database/member.repo.test.ts`
Expected: FAIL — module not found `@/database/member.repo.ts`.

- [ ] **Step 4: Write the repo**

`database/member.repo.ts`:

```ts
import type { CreateMemberDto, MemberInterface, UpdateMemberDto } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

/**
 * Members are the people of a household — credential-less by design; the
 * `User` record is the login and links to its member via `memberId`.
 * Keys are household-scoped (`["members", householdId, id]`), mirroring
 * TodoRepo. See docs/adr/0006.
 */
export class MemberRepo {
  static async create(data: CreateMemberDto): Promise<MemberInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const member: MemberInterface = { ...data, id };
    await kv.set(["members", data.householdId, id], member);
    return member;
  }

  /** Name-ascending, so the picker, the members page, and the hook agree. */
  static async getAll(householdId: string): Promise<MemberInterface[]> {
    const kv = await getKv();
    const members: MemberInterface[] = [];
    for await (
      const { value } of kv.list<MemberInterface>({
        prefix: ["members", householdId],
      })
    ) members.push(value);
    return members.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<MemberInterface | null> {
    const kv = await getKv();
    const result = await kv.get<MemberInterface>(["members", householdId, id]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<MemberInterface>(existing, patch);
    await kv.set(["members", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["members", householdId, id]);
  }

  /** How many managers the household has — the last one can never go. */
  static async countManagers(householdId: string): Promise<number> {
    return (await this.getAll(householdId)).filter((m) => m.isManager).length;
  }
}
```

Add to `database/index.ts`:

```ts
export * from "./member.repo.ts";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno test --unstable-kv -A database/member.repo.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Run the full check and commit**

Run: `deno task check && deno task test`
Expected: all green.

```bash
git add models/member/ models/index.ts database/member.repo.ts database/member.repo.test.ts database/index.ts
git commit -m "feat(members): add Member model, avatar presets, and MemberRepo"
```

---

### Task 2: Users create and link a member; `ensureMember` self-heal

**Files:**
- Modify: `models/user/user.interface.ts`
- Modify: `database/user.repo.ts`
- Test: `database/user.repo.test.ts` (new — no user repo test exists yet)

**Interfaces:**
- Consumes: `MemberRepo.create`, `MemberRepo.getById`, `MemberRepo.delete`, `DEFAULT_AVATAR_COLOR`, `DEFAULT_AVATAR_EMOJI` from Task 1.
- Produces:
  - `UserInterface.memberId?: string` — optional because pre-migration records lack it; `ensureMember` and the migration backfill it.
  - `UserRepo.ensureMember(user: UserInterface): Promise<UserInterface>` — idempotent; creates a manager member named from the username and links it atomically; safe under concurrent calls.
  - `UserRepo.create` now also creates the household's first member (a manager) and stamps the initial shopping list's `createdBy` with the **member** id.

- [ ] **Step 1: Add `memberId` to the user model**

In `models/user/user.interface.ts`:

```ts
export interface UserInterface {
  id: string;
  username: string;
  passwordHash: string;
  householdId: string;
  /**
   * The member this login belongs to. A user is only a credential; the member
   * is the person (see docs/adr/0006). Optional because records created
   * before members existed lack it — UserRepo.ensureMember backfills lazily.
   */
  memberId?: string;
}
```

- [ ] **Step 2: Write the failing tests**

`database/user.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { UserRepo } from "@/database/user.repo.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { UserInterface } from "@/models/index.ts";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name: "create — creates household, manager member, and links memberId",
  sanitizeResources: false,
  async fn() {
    const user = await UserRepo.create({
      username: "robin",
      passwordHash: "x",
    });
    assertEquals(typeof user.memberId, "string");
    const member = await MemberRepo.getById(user.householdId, user.memberId!);
    assertEquals(member?.name, "Robin");
    assertEquals(member?.isManager, true);
  },
});

Deno.test({
  name: "ensureMember — backfills a manager member for a legacy user",
  sanitizeResources: false,
  async fn() {
    // Write a pre-member user record directly, bypassing UserRepo.create.
    const kv = await getKv();
    const legacy: UserInterface = {
      id: "legacy-1",
      username: "alex",
      passwordHash: "x",
      householdId: "hh-legacy",
    };
    await kv.atomic()
      .set(["users", legacy.id], legacy)
      .set(["users_by_username", legacy.username], legacy)
      .commit();

    const linked = await UserRepo.ensureMember(legacy);
    assertEquals(typeof linked.memberId, "string");
    const member = await MemberRepo.getById("hh-legacy", linked.memberId!);
    assertEquals(member?.name, "Alex");
    assertEquals(member?.isManager, true);

    // Idempotent: a second call returns the same link, creates nothing new.
    const again = await UserRepo.ensureMember(linked);
    assertEquals(again.memberId, linked.memberId);
    assertEquals((await MemberRepo.getAll("hh-legacy")).length, 1);
  },
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `deno test --unstable-kv -A database/user.repo.test.ts`
Expected: FAIL — `ensureMember` is not a function; `memberId` undefined on create.

- [ ] **Step 4: Implement in `database/user.repo.ts`**

Add imports at the top:

```ts
import { MemberRepo } from "./member.repo.ts";
import { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_EMOJI } from "@/models/index.ts";
```

Add a module-level helper (above the class):

```ts
/** "robin" → "Robin": the migrated member's starting name, editable later. */
function displayNameFromUsername(username: string): string {
  return username.charAt(0).toUpperCase() + username.slice(1);
}
```

Replace the body of `create` so the member is created after the household and
linked on the user record, and the initial shopping list is attributed to the
member (not the user):

```ts
static async create(
  user: Omit<UserInterface, "id" | "householdId" | "memberId">,
): Promise<UserInterface> {
  const kv = await getKv();
  const id = crypto.randomUUID();
  const household = await HouseholdRepo.create(
    `${user.username}'s household`,
  );
  const member = await MemberRepo.create({
    householdId: household.id,
    name: displayNameFromUsername(user.username),
    color: DEFAULT_AVATAR_COLOR,
    emoji: DEFAULT_AVATAR_EMOJI,
    isManager: true,
  });
  const userWithId: UserInterface = {
    ...user,
    id,
    householdId: household.id,
    memberId: member.id,
  };
  await kv
    .atomic()
    .set(["users", userWithId.id], userWithId)
    .set(["users_by_username", user.username], userWithId)
    .commit();
  await ShoppingListRepo.create({
    householdId: household.id,
    name: "Shopping List",
    createdBy: member.id,
    createdAt: new Date().toISOString(),
  });
  return userWithId;
}
```

Add `ensureMember` to the class:

```ts
/**
 * Backfills the user→member link for records created before members existed.
 * Called lazily from the auth middleware (sessions outlive deploys, so a
 * login-time hook would miss everyone already signed in) and from the data
 * migration. Concurrency-safe: the atomic check makes the loser of a race
 * discard its member and adopt the winner's.
 */
static async ensureMember(user: UserInterface): Promise<UserInterface> {
  if (user.memberId) return user;
  const kv = await getKv();
  const entry = await kv.get<UserInterface>(["users", user.id]);
  if (!entry.value) return user;
  if (entry.value.memberId) return entry.value;

  const member = await MemberRepo.create({
    householdId: entry.value.householdId,
    name: displayNameFromUsername(entry.value.username),
    color: DEFAULT_AVATAR_COLOR,
    emoji: DEFAULT_AVATAR_EMOJI,
    isManager: true,
  });
  const updated: UserInterface = { ...entry.value, memberId: member.id };
  const res = await kv
    .atomic()
    .check(entry)
    .set(["users", user.id], updated)
    .set(["users_by_username", updated.username], updated)
    .commit();
  if (!res.ok) {
    // Lost a race with a concurrent ensureMember — the winner's member stands.
    await MemberRepo.delete(entry.value.householdId, member.id);
    return (await this.findById(user.id)) ?? user;
  }
  return updated;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno test --unstable-kv -A database/user.repo.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Full check, commit**

Run: `deno task check && deno task test`
Expected: all green (existing suites unaffected — `memberId` is optional).

```bash
git add models/user/user.interface.ts database/user.repo.ts database/user.repo.test.ts
git commit -m "feat(members): link users to their member; ensureMember backfill"
```

---

### Task 3: Acting-member cookie + middleware resolution

**Files:**
- Create: `utils/acting-member-cookie.ts`
- Test: `utils/acting-member-cookie.test.ts`
- Modify: `utils/index.ts`
- Modify: `utils/define.ts` (StateInterface)
- Modify: `routes/_middleware.ts`

**Interfaces:**
- Consumes: `MemberRepo.getById`, `UserRepo.ensureMember` (Tasks 1–2).
- Produces:
  - `ACTING_MEMBER_COOKIE_NAME = "actingMemberId"`
  - `setActingMemberCookie(headers: Headers, memberId: string): void`
  - `deleteActingMemberCookie(headers: Headers): void`
  - `StateInterface.actingMember?: MemberInterface` — the member this request acts as. Always set for authenticated requests: the cookie's member when the cookie resolves, otherwise the login's linked member.
  - `StateInterface.actingClaimed?: boolean` — true only when a *valid* cookie claim exists. The chip island uses this to auto-open the picker on unclaimed devices (Q6: a new device picks; it is not silently the login's member).

- [ ] **Step 1: Write the failing cookie test**

`utils/acting-member-cookie.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  deleteActingMemberCookie,
  setActingMemberCookie,
} from "@/utils/acting-member-cookie.ts";

Deno.test("setActingMemberCookie — long-lived, HttpOnly, host-only, Path=/", () => {
  const headers = new Headers();
  setActingMemberCookie(headers, "m-123");
  const cookie = headers.get("set-cookie")!;
  assertEquals(cookie.includes("actingMemberId=m-123"), true);
  assertEquals(cookie.includes("HttpOnly"), true);
  assertEquals(cookie.includes("Secure"), true);
  assertEquals(cookie.includes("Path=/"), true);
  assertEquals(cookie.includes("Max-Age=34560000"), true);
  assertEquals(cookie.includes("Domain="), false); // host-only, like the session cookie
});

Deno.test("deleteActingMemberCookie — clears with matching name and path", () => {
  const headers = new Headers();
  deleteActingMemberCookie(headers);
  const cookie = headers.get("set-cookie")!;
  assertEquals(cookie.includes("actingMemberId="), true);
  assertEquals(cookie.includes("Path=/"), true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `deno test --unstable-kv -A utils/acting-member-cookie.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `utils/acting-member-cookie.ts`**

```ts
import { deleteCookie, setCookie } from "$std/http/cookie.ts";

export const ACTING_MEMBER_COOKIE_NAME = "actingMemberId";

/** 400 days — the browser maximum. The claim is per-device and should
 *  effectively never expire on its own (Q6: pick once per device). */
const ACTING_MEMBER_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * The single place that knows the acting-member cookie's attributes. Same
 * shape as the session cookie (utils/session-cookie.ts) and for the same
 * reasons: host-only (no Domain — see the LAN-testing note there), HttpOnly
 * (exempts it from Safari ITP's 7-day purge of script-writable storage, which
 * would otherwise make every iOS PWA device re-pick weekly).
 */
export function setActingMemberCookie(
  headers: Headers,
  memberId: string,
): void {
  setCookie(headers, {
    name: ACTING_MEMBER_COOKIE_NAME,
    value: memberId,
    maxAge: ACTING_MEMBER_MAX_AGE,
    sameSite: "Lax",
    path: "/",
    secure: true,
    httpOnly: true,
  });
}

/** Mirror of setActingMemberCookie: same name, Path=/, host-only. */
export function deleteActingMemberCookie(headers: Headers): void {
  deleteCookie(headers, ACTING_MEMBER_COOKIE_NAME, { path: "/" });
}
```

Add to `utils/index.ts`:

```ts
export * from "./acting-member-cookie.ts";
```

- [ ] **Step 4: Run the cookie tests**

Run: `deno test --unstable-kv -A utils/acting-member-cookie.test.ts`
Expected: 2 passed. (If an attribute assertion fails on casing, check the
actual `set-cookie` string produced by `$std/http/cookie` and match it — the
std lib emits `HttpOnly`, `Secure`, `Max-Age`, `Path`.)

- [ ] **Step 5: Extend `StateInterface`**

In `utils/define.ts`, add to the imports and interface:

```ts
import type { MemberInterface } from "../models/index.ts";
```

```ts
export interface StateInterface {
  userId?: string;
  householdId?: string;
  /** The member this request acts as (cookie claim, else the login's member). */
  actingMember?: MemberInterface;
  /** True only when a valid actingMemberId cookie made the claim. */
  actingClaimed?: boolean;
  items?: ItemInterface[];
  shoppingList?: ShoppingListItemInterface[];
  error?: string;
  appBar?: AppBar;
}
```

(Import `MemberInterface` alongside the existing model imports at the top — `import { ItemInterface, MemberInterface, ShoppingListItemInterface } from "../models/index.ts";`.)

- [ ] **Step 6: Resolve the acting member in `routes/_middleware.ts`**

Add imports:

```ts
import { MemberRepo } from "@/database/member.repo.ts";
import { ACTING_MEMBER_COOKIE_NAME } from "@/utils/index.ts";
```

Change the middleware's `State` interface to reuse the shared one — replace the local `interface State {...}` and the `Context<State>` signature with:

```ts
import { type StateInterface } from "@/utils/define.ts";

export async function handler(
  ctx: Context<StateInterface>,
) {
```

Replace the session-valid block (currently lines 41–43: `const user = await UserRepo.findById(...)` through `ctx.state.householdId = ...`) with:

```ts
let user = await UserRepo.findById(session.userId);
// Legacy records predate members — backfill the link once, lazily, here
// (sessions outlive deploys, so a login-time hook would miss everyone
// already signed in). No-op when memberId is already set.
if (user && !user.memberId) user = await UserRepo.ensureMember(user);
ctx.state.userId = session.userId;
ctx.state.householdId = user?.householdId;

if (user?.householdId) {
  // The device's claimed member, when the claim still resolves. A cookie
  // pointing at a removed member is treated as no claim: the chip island
  // re-opens the picker (Q6/Q9 — graceful dangle, never a crash).
  const claimedId = cookies[ACTING_MEMBER_COOKIE_NAME];
  const claimed = claimedId
    ? await MemberRepo.getById(user.householdId, claimedId)
    : null;
  ctx.state.actingClaimed = claimed !== null;
  ctx.state.actingMember = claimed ??
    (user.memberId
      ? await MemberRepo.getById(user.householdId, user.memberId) ?? undefined
      : undefined);
}
```

- [ ] **Step 7: Full check, commit**

Run: `deno task check && deno task test`
Expected: all green.

```bash
git add utils/acting-member-cookie.ts utils/acting-member-cookie.test.ts utils/index.ts utils/define.ts routes/_middleware.ts
git commit -m "feat(members): resolve an acting member per request from a device cookie"
```

---

### Task 4: Members API — list, create, edit, remove (with permission rules)

**Files:**
- Create: `utils/manager.ts`
- Modify: `utils/index.ts`
- Create: `routes/api/members/index.ts`
- Create: `routes/api/members/[id].ts`
- Test: `routes/api/members/index.test.ts`
- Test: `routes/api/members/[id].test.ts`

**Interfaces:**
- Consumes: `MemberRepo` (Task 1), `StateInterface.actingMember` (Task 3), `json/badRequest/notFound/noContent` from `utils/http.ts`, `ACTING_MEMBER_COOKIE_NAME`/`deleteActingMemberCookie` (Task 3), `isAvatarColor` (Task 1).
- Produces:
  - `requireManager(ctx: Context<StateInterface>): Response | null` — `null` when the acting member is a manager, otherwise a 403 `Response`. Reused by Task 6.
  - `GET /api/members` → `MemberInterface[]` (any member).
  - `POST /api/members` (manager only) body `MemberInput` → 201 `MemberInterface`.
  - `PATCH /api/members/:id` — self may change `name`/`color`/`emoji`; only managers may edit others or touch `isManager`; demoting the last manager → 409.
  - `DELETE /api/members/:id` (manager only) — removing the last manager → 409; clears the device's acting cookie when it claimed the removed member.

Permission rules (from the grilling): self-edit of name+avatar for everyone; add/remove/edit-others/promote are manager-only; the last manager can be neither demoted nor removed (server rejects with 409).

- [ ] **Step 1: Write `utils/manager.ts` (tiny, tested through the routes)**

```ts
import { type Context } from "fresh";
import { type StateInterface } from "./define.ts";

/**
 * Manager gate for destructive endpoints (see docs/adr/0006: a guardrail
 * against curious kids, enforced against the *claimed* acting member, not a
 * security boundary). Returns null when the acting member manages the
 * household, otherwise the 403 to return.
 */
export function requireManager(
  ctx: Context<StateInterface>,
): Response | null {
  if (ctx.state.actingMember?.isManager) return null;
  return new Response("Only a household manager can do that", { status: 403 });
}
```

Add to `utils/index.ts`:

```ts
export * from "./manager.ts";
```

- [ ] **Step 2: Write the failing tests for the collection route**

`routes/api/members/index.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/index.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function member(
  id: string,
  householdId: string,
  isManager: boolean,
): MemberInterface {
  return { id, householdId, name: "N", color: "sky", emoji: "🙂", isManager };
}

function ctx(req: Request, state: StateInterface): Context<StateInterface> {
  return { req, state, params: {} } as unknown as Context<StateInterface>;
}

async function clearMembers() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["members"] })) await kv.delete(e.key);
}

const post = (body: unknown) =>
  new Request("http://x/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const MANAGER = member("m-mgr", "h1", true);
const KID = member("m-kid", "h1", false);

Deno.test({
  name: "GET — lists the household's members for any member",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    await MemberRepo.create({ householdId: "h1", name: "Bo", color: "meadow", emoji: "🐸", isManager: false });
    const res = await handler.GET(
      ctx(new Request("http://x/api/members"), { householdId: "h1", actingMember: KID }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).length, 1);
  },
});

Deno.test({
  name: "POST — a manager creates a member",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const res = await handler.POST(
      ctx(post({ name: "Pip", color: "lavender", emoji: "🦄" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(res.status, 201);
    const created = await res.json();
    assertEquals(created.name, "Pip");
    assertEquals(created.isManager, false);
    assertEquals(created.householdId, "h1");
  },
});

Deno.test({
  name: "POST — a non-manager gets 403",
  sanitizeResources: false,
  async fn() {
    const res = await handler.POST(
      ctx(post({ name: "Pip", color: "lavender", emoji: "🦄" }), {
        householdId: "h1",
        actingMember: KID,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "POST — rejects a missing name and an unknown colour",
  sanitizeResources: false,
  async fn() {
    const noName = await handler.POST(
      ctx(post({ name: "  ", color: "sky", emoji: "🙂" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(noName.status, 400);
    const badColor = await handler.POST(
      ctx(post({ name: "Pip", color: "neon", emoji: "🙂" }), {
        householdId: "h1",
        actingMember: MANAGER,
      }),
    );
    assertEquals(badColor.status, 400);
  },
});
```

- [ ] **Step 3: Run to verify failure**

Run: `deno test --unstable-kv -A routes/api/members/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `routes/api/members/index.ts`**

```ts
import { badRequest, define, json, requireManager } from "@/utils/index.ts";
import { MemberRepo } from "@/database/index.ts";
import { isAvatarColor } from "@/models/index.ts";

/** Shared field validation for create (all fields) — returns a message or the
 *  cleaned values. PATCH re-validates per-field in [id].ts. */
export function parseMemberFields(
  body: Record<string, unknown>,
): { name: string; color: string; emoji: string } | string {
  const name = String(body.name ?? "").trim();
  if (!name) return "name required";
  if (!isAvatarColor(body.color)) return "unknown color";
  const emoji = String(body.emoji ?? "").trim();
  if (!emoji || emoji.length > 16) return "emoji must be a short glyph";
  return { name, color: body.color, emoji };
}

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await MemberRepo.getAll(householdId));
  },

  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;

    const body = await ctx.req.json();
    const fields = parseMemberFields(body);
    if (typeof fields === "string") return badRequest(fields);

    const member = await MemberRepo.create({
      householdId,
      ...fields,
      isManager: body.isManager === true,
    });
    return json(member, 201);
  },
});
```

- [ ] **Step 5: Run the collection tests**

Run: `deno test --unstable-kv -A routes/api/members/index.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Write the failing tests for the item route**

`routes/api/members/[id].test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/[id].ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MemberInterface } from "@/models/index.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(
  req: Request,
  id: string,
  state: StateInterface,
): Context<StateInterface> {
  return { req, state, params: { id } } as unknown as Context<StateInterface>;
}

async function clearMembers() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["members"] })) await kv.delete(e.key);
}

const patch = (body: unknown) =>
  new Request("http://x/api/members/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = () => new Request("http://x/api/members/x", { method: "DELETE" });

function seed(
  name: string,
  isManager: boolean,
  householdId = "h1",
): Promise<MemberInterface> {
  return MemberRepo.create({
    householdId,
    name,
    color: "sky",
    emoji: "🙂",
    isManager,
  });
}

Deno.test({
  name: "PATCH — anyone edits their own name and avatar",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const res = await handler.PATCH(
      ctx(patch({ name: "Bo!", emoji: "🐸" }), kid.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 200);
    const updated = await res.json();
    assertEquals(updated.name, "Bo!");
    assertEquals(updated.emoji, "🐸");
  },
});

Deno.test({
  name: "PATCH — a non-manager cannot edit someone else",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const other = await seed("Pip", false);
    const res = await handler.PATCH(
      ctx(patch({ name: "Nope" }), other.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "PATCH — a non-manager cannot touch isManager, even on themselves",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const kid = await seed("Bo", false);
    const res = await handler.PATCH(
      ctx(patch({ isManager: true }), kid.id, {
        householdId: "h1",
        actingMember: kid,
      }),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "PATCH — demoting the last manager is rejected with 409",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const res = await handler.PATCH(
      ctx(patch({ isManager: false }), mgr.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(res.status, 409);
  },
});

Deno.test({
  name: "PATCH — a manager demotes a manager when another remains",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const second = await seed("Robin", true);
    const res = await handler.PATCH(
      ctx(patch({ isManager: false }), second.id, {
        householdId: "h1",
        actingMember: mgr,
      }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).isManager, false);
  },
});

Deno.test({
  name: "DELETE — manager removes a member; kid gets 403",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const kid = await seed("Bo", false);
    const forbidden = await handler.DELETE(
      ctx(del(), mgr.id, { householdId: "h1", actingMember: kid }),
    );
    assertEquals(forbidden.status, 403);
    const ok = await handler.DELETE(
      ctx(del(), kid.id, { householdId: "h1", actingMember: mgr }),
    );
    assertEquals(ok.status, 204);
    assertEquals(await MemberRepo.getById("h1", kid.id), null);
  },
});

Deno.test({
  name: "DELETE — removing the last manager is rejected with 409",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const mgr = await seed("Alex", true);
    const res = await handler.DELETE(
      ctx(del(), mgr.id, { householdId: "h1", actingMember: mgr }),
    );
    assertEquals(res.status, 409);
  },
});
```

- [ ] **Step 7: Run to verify failure**

Run: `deno test --unstable-kv -A "routes/api/members/[id].test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 8: Write `routes/api/members/[id].ts`**

```ts
import { getCookies } from "$std/http/cookie.ts";
import {
  ACTING_MEMBER_COOKIE_NAME,
  badRequest,
  define,
  deleteActingMemberCookie,
  json,
  notFound,
  requireManager,
} from "@/utils/index.ts";
import { MemberRepo } from "@/database/index.ts";
import { isAvatarColor, type UpdateMemberDto } from "@/models/index.ts";

const LAST_MANAGER_MSG =
  "The household needs at least one manager — promote someone else first";

export const handler = define.handlers({
  async PATCH(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }
    const target = await MemberRepo.getById(householdId, ctx.params.id);
    if (!target) return notFound("no such member");

    // Self-edit of name/avatar is open to everyone; everything else is
    // manager-only (grilled Q8).
    const isSelf = actingMember.id === target.id;
    if (!actingMember.isManager && !isSelf) {
      return new Response("Only a household manager can edit someone else", {
        status: 403,
      });
    }

    const body = await ctx.req.json();
    const patch: UpdateMemberDto = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return badRequest("name required");
      patch.name = name;
    }
    if (body.color !== undefined) {
      if (!isAvatarColor(body.color)) return badRequest("unknown color");
      patch.color = body.color;
    }
    if (body.emoji !== undefined) {
      const emoji = String(body.emoji).trim();
      if (!emoji || emoji.length > 16) {
        return badRequest("emoji must be a short glyph");
      }
      patch.emoji = emoji;
    }
    if (body.isManager !== undefined) {
      if (!actingMember.isManager) {
        return new Response(
          "Only a household manager can change who manages",
          { status: 403 },
        );
      }
      if (typeof body.isManager !== "boolean") {
        return badRequest("isManager must be a boolean");
      }
      if (
        body.isManager === false && target.isManager &&
        await MemberRepo.countManagers(householdId) <= 1
      ) {
        return new Response(LAST_MANAGER_MSG, { status: 409 });
      }
      patch.isManager = body.isManager;
    }

    const updated = await MemberRepo.update(householdId, target.id, patch);
    if (!updated) return notFound("no such member");
    return json(updated);
  },

  async DELETE(ctx) {
    const { householdId } = ctx.state;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;

    const target = await MemberRepo.getById(householdId, ctx.params.id);
    if (!target) return notFound("no such member");
    if (
      target.isManager && await MemberRepo.countManagers(householdId) <= 1
    ) {
      return new Response(LAST_MANAGER_MSG, { status: 409 });
    }

    // Hard delete, graceful dangle: attribution (createdBy) may now point at
    // a member that no longer resolves; renderers fall back (grilled Q9).
    await MemberRepo.delete(householdId, target.id);

    // If this device's cookie claimed the removed member, clear it so the
    // picker reappears on the next visit rather than a stale claim lingering.
    const headers = new Headers();
    if (getCookies(ctx.req.headers)[ACTING_MEMBER_COOKIE_NAME] === target.id) {
      deleteActingMemberCookie(headers);
    }
    return new Response(null, { status: 204, headers });
  },
});
```

- [ ] **Step 9: Run the item tests**

Run: `deno test --unstable-kv -A "routes/api/members/[id].test.ts"`
Expected: 7 passed.

- [ ] **Step 10: Full check, commit**

Run: `deno task check && deno task test`

```bash
git add utils/manager.ts utils/index.ts routes/api/members/
git commit -m "feat(members): members API with manager permissions and last-manager guard"
```

---

### Task 5: Claiming the acting member — `PUT /api/members/acting`

**Files:**
- Create: `routes/api/members/acting.ts`
- Test: `routes/api/members/acting.test.ts`

**Interfaces:**
- Consumes: `MemberRepo.getById` (Task 1), `setActingMemberCookie` (Task 3).
- Produces: `PUT /api/members/acting` body `{ memberId: string }` → 200 with the member JSON and a `Set-Cookie: actingMemberId=…`; 404 when the member isn't in the household; 400 when memberId is missing. Used by `api.members.claim` (Task 10).

- [ ] **Step 1: Write the failing test**

`routes/api/members/acting.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/members/acting.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import type { StateInterface } from "@/utils/define.ts";

Deno.env.set("KV_PATH", ":memory:");

function ctx(req: Request, state: StateInterface): Context<StateInterface> {
  return { req, state, params: {} } as unknown as Context<StateInterface>;
}

const put = (body: unknown) =>
  new Request("http://x/api/members/acting", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "PUT — claims a member of the household and sets the cookie",
  sanitizeResources: false,
  async fn() {
    const bo = await MemberRepo.create({
      householdId: "h-act",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });
    const res = await handler.PUT(
      ctx(put({ memberId: bo.id }), { householdId: "h-act" }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).id, bo.id);
    const cookie = res.headers.get("set-cookie")!;
    assertEquals(cookie.includes(`actingMemberId=${bo.id}`), true);
  },
});

Deno.test({
  name: "PUT — a member of another household is 404; missing id is 400",
  sanitizeResources: false,
  async fn() {
    const stranger = await MemberRepo.create({
      householdId: "h-other",
      name: "Sam",
      color: "slate",
      emoji: "🐼",
      isManager: true,
    });
    const notMine = await handler.PUT(
      ctx(put({ memberId: stranger.id }), { householdId: "h-act" }),
    );
    assertEquals(notMine.status, 404);
    const missing = await handler.PUT(ctx(put({}), { householdId: "h-act" }));
    assertEquals(missing.status, 400);
  },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --unstable-kv -A routes/api/members/acting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `routes/api/members/acting.ts`**

```ts
import {
  badRequest,
  define,
  json,
  notFound,
  setActingMemberCookie,
} from "@/utils/index.ts";
import { MemberRepo } from "@/database/index.ts";

export const handler = define.handlers({
  /**
   * "I am this member on this device." Validates the member belongs to the
   * caller's household, then persists the claim in an HttpOnly cookie. Honor
   * system by design — see docs/adr/0006.
   */
  async PUT(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    const memberId = String(body.memberId ?? "");
    if (!memberId) return badRequest("memberId required");
    const member = await MemberRepo.getById(householdId, memberId);
    if (!member) return notFound("no such member");
    const res = json(member);
    setActingMemberCookie(res.headers, member.id);
    return res;
  },
});
```

- [ ] **Step 4: Run the tests**

Run: `deno test --unstable-kv -A routes/api/members/acting.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Full check, commit**

Run: `deno task check && deno task test`

```bash
git add routes/api/members/acting.ts routes/api/members/acting.test.ts
git commit -m "feat(members): claim the acting member per device via cookie"
```

---

### Task 6: Manager-gate the six destructive endpoints

**Files:**
- Modify: `routes/api/todos/[id].ts` (DELETE)
- Modify: `routes/api/cards/index.ts` (DELETE)
- Modify: `routes/api/shopping/catalogue.ts` (DELETE)
- Modify: `routes/api/shopping/categories.ts` (DELETE)
- Modify: `routes/api/menu/dishes.ts` (DELETE)
- Modify: `routes/api/shopping/lists/[id]/index.ts` (DELETE)
- Test: add cases to `routes/api/todos/[id].test.ts`, `routes/api/cards/index.test.ts`, `routes/api/shopping/catalogue.test.ts`, `routes/api/shopping/categories.test.ts`, `routes/api/menu/dishes.test.ts`
- Test: create `routes/api/shopping/lists/[id]/index.test.ts` (no test exists for this route yet — cover only the DELETE gate)

The gated line (grilled Q13): deleting a shopping list, catalogue item, category, dish, or loyalty card, and marking a to-do "not needed" (its DELETE) are manager-only. **Not** gated: removing a single list item (`lists/[id]/items.ts`) and bulk-clearing checked items (`items/checked.ts`) — routine collaborative actions.

**Interfaces:**
- Consumes: `requireManager` (Task 4), `StateInterface.actingMember` (Task 3).
- Produces: each gated DELETE returns 403 for a non-manager acting member, unchanged behavior for managers.

- [ ] **Step 1: Write the failing tests**

The same two-case pattern per endpoint. For `routes/api/todos/[id].test.ts`, first extend the local test `State` interface and add manager fixtures near the existing `AUTH` const:

```ts
import type { MemberInterface } from "@/models/index.ts";

interface State {
  userId?: string;
  householdId?: string;
  actingMember?: MemberInterface;
}

const MANAGER: MemberInterface = {
  id: "m-mgr", householdId: "h1", name: "Alex",
  color: "sky", emoji: "⭐", isManager: true,
};
const KID: MemberInterface = {
  id: "m-kid", householdId: "h1", name: "Bo",
  color: "meadow", emoji: "🐸", isManager: false,
};
const AUTH_MANAGER: State = { userId: "u1", householdId: "h1", actingMember: MANAGER };
const AUTH_KID: State = { userId: "u1", householdId: "h1", actingMember: KID };
```

Then add:

```ts
Deno.test({
  name: "DELETE — a non-manager acting member gets 403",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.DELETE(ctx(del(), todo.id, AUTH_KID));
    assertEquals(res.status, 403);
    // Still there — nothing was deleted.
    assertEquals((await TodoRepo.getById("h1", todo.id))?.id, todo.id);
  },
});

Deno.test({
  name: "DELETE — a manager acting member deletes",
  sanitizeResources: false,
  async fn() {
    await clearTodos();
    const todo = await seed();
    const res = await handler.DELETE(ctx(del(), todo.id, AUTH_MANAGER));
    assertEquals(res.status, 204);
  },
});
```

**Important:** the existing DELETE tests in these files pass a state without `actingMember` — after the gate they would get 403. Update every existing DELETE test's state to include `actingMember: MANAGER` (same fixture shape as above, with the file's own `householdId`). Do the equivalent in `cards/index.test.ts`, `shopping/catalogue.test.ts`, `shopping/categories.test.ts`, and `menu/dishes.test.ts` — each gets the MANAGER/KID fixtures, a 403 case, a happy-path-as-manager case, and its existing DELETE tests updated to act as the manager.

For the new `routes/api/shopping/lists/[id]/index.test.ts`, follow the same handler-test shape (`ctx(req, id, state)` helper, `ShoppingListRepo.create` to seed a list in `h1`, DELETE as KID → 403 and list still present, DELETE as MANAGER → 204).

- [ ] **Step 2: Run to verify the new cases fail**

Run: `deno task test`
Expected: the new 403 cases FAIL (endpoints don't gate yet); everything else passes.

- [ ] **Step 3: Apply the gate**

In each of the six route files, add `requireManager` to the `@/utils/index.ts` import and insert the same two lines at the top of the DELETE handler, right after the existing auth check (for `lists/[id]/index.ts`, place it *before* the `authorizeList` call; for the others, after the `householdId` 401 guard):

```ts
const forbidden = requireManager(ctx);
if (forbidden) return forbidden;
```

Example — `routes/api/todos/[id].ts` DELETE becomes:

```ts
async DELETE(ctx) {
  const householdId = ctx.state.householdId;
  if (!householdId) return new Response("Unauthorized", { status: 401 });
  // "Not needed" is a deletion (ADR 0002) and deletions are manager-only
  // (ADR 0006): a kid ticks things off; deciding "we dropped it" is a
  // manager call.
  const forbidden = requireManager(ctx);
  if (forbidden) return forbidden;

  const existing = await TodoRepo.getById(householdId, ctx.params.id);
  if (!existing) return notFound("no such to-do");

  await TodoRepo.delete(householdId, existing.id);
  return noContent();
},
```

- [ ] **Step 4: Run the full suite**

Run: `deno task test`
Expected: all green, including the new 403/manager cases.

- [ ] **Step 5: Check, commit**

Run: `deno task check`

```bash
git add routes/api/
git commit -m "feat(members): manager-gate destructive endpoints"
```

---

### Task 7: Attribution — `createdBy` becomes the acting member

**Files:**
- Modify: `routes/api/todos/index.ts` (POST)
- Modify: `routes/api/cards/index.ts` (POST)
- Modify: `routes/api/shopping/lists.ts` (POST)
- Modify: `models/todo/todo.interface.ts` (doc comment only)
- Test: add/adjust cases in `routes/api/todos/index.test.ts` and `routes/api/cards/index.test.ts`

**Interfaces:**
- Consumes: `StateInterface.actingMember` (Task 3).
- Produces: every new to-do, loyalty card, and shopping list stores the **acting member's id** in `createdBy`. POST without an acting member → 401 (cannot happen for a real authed request after Task 3's fallback, but handler tests construct state directly).

- [ ] **Step 1: Write the failing test (todos)**

In `routes/api/todos/index.test.ts`, add the MANAGER fixture as in Task 6 (or reuse if the file already has one from shared edits), then:

```ts
Deno.test({
  name: "POST — stamps createdBy with the acting member",
  sanitizeResources: false,
  async fn() {
    const res = await handler.POST(
      ctx(post({ title: "Book the venue" }), {
        userId: "u1",
        householdId: "h-attr",
        actingMember: { ...MANAGER, householdId: "h-attr" },
      }),
    );
    assertEquals(res.status, 201);
    assertEquals((await res.json()).createdBy, "m-mgr");
  },
});
```

(Use the file's existing `ctx`/`post` helpers; if its POST tests fail after the change because their state lacks `actingMember`, add the fixture to their state.)

- [ ] **Step 2: Run to verify it fails**

Run: `deno test --unstable-kv -A routes/api/todos/index.test.ts`
Expected: the new case FAILS (createdBy is still the userId).

- [ ] **Step 3: Switch the three POST handlers**

`routes/api/todos/index.ts` POST — replace the state destructure and guard:

```ts
const { householdId, actingMember } = ctx.state;
if (!householdId || !actingMember) {
  return new Response("Unauthorized", { status: 401 });
}
```

and the create call's attribution:

```ts
createdBy: actingMember.id,
```

Same change in `routes/api/cards/index.ts` POST (`createdBy: actingMember.id`) and `routes/api/shopping/lists.ts` POST (replace `const userId = ctx.state.userId;` + guard with the destructure above, and `createdBy: userId` → `createdBy: actingMember.id`).

- [ ] **Step 4: Update the model comment**

In `models/todo/todo.interface.ts` replace the `createdBy` doc line:

```ts
/** memberId of the acting member who added it (see docs/adr/0006). Rows
 *  written before members existed were rewritten by the migration. */
createdBy: string;
```

- [ ] **Step 5: Run the full suite, fix any test state that lacks `actingMember`**

Run: `deno task test`
Expected: all green after updating existing POST tests' state.

- [ ] **Step 6: Check, commit**

Run: `deno task check`

```bash
git add routes/api/ models/todo/todo.interface.ts
git commit -m "feat(members): attribute creations to the acting member"
```

---

### Task 8: Migration — member per user, rewrite `createdBy`

**Files:**
- Modify: `scripts/migrate.ts`
- Test: `scripts/migrate.test.ts` (append)

**Interfaces:**
- Consumes: `UserRepo.ensureMember` (Task 2).
- Produces: `migrateMembers(kv: Deno.Kv): Promise<{ membersCreated: number; createdByRewritten: number }>` — exported for tests; wired into `migrate()`'s main flow. Idempotent: re-runs create nothing and rewrite nothing (the rewrite map is keyed by *user* ids, which no longer appear once rewritten).

- [ ] **Step 1: Write the failing test**

Append to `scripts/migrate.test.ts` (it already sets up the in-memory KV — follow its existing conventions for env/imports):

```ts
import { migrateMembers } from "@/scripts/migrate.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { TodoRepo } from "@/database/todo.repo.ts";
import type { UserInterface } from "@/models/index.ts";

Deno.test({
  name: "migrateMembers — backfills manager members and rewrites createdBy",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    // A legacy user without memberId, plus a to-do attributed to the userId.
    const legacy: UserInterface = {
      id: "mig-u1",
      username: "casey",
      passwordHash: "x",
      householdId: "hh-mig",
    };
    await kv.atomic()
      .set(["users", legacy.id], legacy)
      .set(["users_by_username", legacy.username], legacy)
      .commit();
    const todo = await TodoRepo.create({
      householdId: "hh-mig",
      title: "Renew the passport",
      createdBy: "mig-u1", // pre-member attribution: a userId
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueAt: null,
    });

    const first = await migrateMembers(kv);
    assertEquals(first.membersCreated >= 1, true);
    assertEquals(first.createdByRewritten >= 1, true);

    const migratedUser =
      (await kv.get<UserInterface>(["users", "mig-u1"])).value!;
    const member = await MemberRepo.getById("hh-mig", migratedUser.memberId!);
    assertEquals(member?.name, "Casey");
    assertEquals(member?.isManager, true);

    const rewritten = await TodoRepo.getById("hh-mig", todo.id);
    assertEquals(rewritten?.createdBy, migratedUser.memberId);

    // Idempotent: the second run touches nothing.
    const second = await migrateMembers(kv);
    assertEquals(second.membersCreated, 0);
    assertEquals(second.createdByRewritten, 0);
  },
});
```

(Reuse the file's existing `getKv`/`assertEquals` imports rather than duplicating them.)

- [ ] **Step 2: Run to verify it fails**

Run: `deno test --unstable-kv -A scripts/migrate.test.ts`
Expected: FAIL — `migrateMembers` not exported.

- [ ] **Step 3: Implement `migrateMembers` in `scripts/migrate.ts`**

Add after `migrateCatalogue`:

```ts
/** Collections whose `createdBy` predates members and stored a userId. */
const ATTRIBUTED_COLLECTIONS = [
  "todos",
  "loyalty_cards",
  "shopping_lists",
] as const;

/**
 * (4) Members: every user gets a linked manager member (via
 * UserRepo.ensureMember), then all `createdBy` fields that hold a *user* id
 * are rewritten to that user's member id — one id-space, no dual reads (see
 * docs/adr/0006). Idempotent: the rewrite map is keyed by user ids, which no
 * longer appear in createdBy once rewritten.
 */
export async function migrateMembers(
  kv: Deno.Kv,
): Promise<{ membersCreated: number; createdByRewritten: number }> {
  let membersCreated = 0;
  let createdByRewritten = 0;

  const memberIdByUserId = new Map<string, string>();
  for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
    const user = entry.value;
    if (!user?.id) continue;
    const hadMember = !!user.memberId;
    const linked = await UserRepo.ensureMember(user);
    if (!linked.memberId) continue;
    if (!hadMember) membersCreated++;
    memberIdByUserId.set(user.id, linked.memberId);
  }

  for (const collection of ATTRIBUTED_COLLECTIONS) {
    for await (
      const entry of kv.list<{ createdBy?: string }>({ prefix: [collection] })
    ) {
      const mapped = entry.value?.createdBy
        ? memberIdByUserId.get(entry.value.createdBy)
        : undefined;
      if (!mapped) continue;
      await kv.set(entry.key, { ...entry.value, createdBy: mapped });
      createdByRewritten++;
    }
  }

  return { membersCreated, createdByRewritten };
}
```

Wire it into `migrate()` after the `migrateCatalogue` call:

```ts
const members = await migrateMembers(kv);
```

and extend the final `console.log` summary with:

```
  Members: ${members.membersCreated} created, ${members.createdByRewritten} createdBy rewritten
```

Also update the file-header comment to mention step (4).

- [ ] **Step 4: Run the migration tests**

Run: `deno test --unstable-kv -A scripts/migrate.test.ts`
Expected: all pass, including pre-existing tests.

- [ ] **Step 5: Check, commit**

Run: `deno task check && deno task test`

```bash
git add scripts/migrate.ts scripts/migrate.test.ts
git commit -m "feat(members): migrate users to linked members and rewrite createdBy"
```

---

### Task 9: Seed data — members per fixture household

**Files:**
- Modify: `scripts/seed/fixtures.ts`
- Modify: `scripts/seed/runner.ts`
- Test: `scripts/seed/runner.test.ts` (append)

**Interfaces:**
- Consumes: `MemberRepo.create` (Task 1).
- Produces: every fixture user gets a `members` array; the runner creates them per household, links `user.memberId` to the **first** entry, and resets the `["members"]` prefix on reseed.

- [ ] **Step 1: Extend the fixtures**

In `scripts/seed/fixtures.ts`, add to the fixture-user interface (around line 31):

```ts
export interface FixtureMember {
  name: string;
  color: string;
  emoji: string;
  isManager: boolean;
}
```

and a `members: FixtureMember[];` field on the fixture-user interface. Then give each fixture user members — the **first is the login's linked member and must be a manager**:

- `demo` (the primary): `[{ name: "Demo", color: "coral", emoji: "🦊", isManager: true }, { name: "Robin", color: "sunshine", emoji: "🌻", isManager: true }, { name: "Bo", color: "meadow", emoji: "🐸", isManager: false }, { name: "Pip", color: "lavender", emoji: "🦄", isManager: false }]`
- `alex`: `[{ name: "Alex", color: "sky", emoji: "⭐", isManager: true }]`
- `sam`: `[{ name: "Sam", color: "slate", emoji: "🐼", isManager: true }]`

- [ ] **Step 2: Write the failing runner test**

Append to `scripts/seed/runner.test.ts` (reusing its existing setup/conventions):

```ts
Deno.test({
  name: "runSeed — creates members per household and links the user",
  sanitizeResources: false,
  async fn() {
    await runSeed({});
    const kv = await getKv();
    const demo =
      (await kv.get<UserInterface>(["users_by_username", "demo"])).value!;
    assertEquals(typeof demo.memberId, "string");
    const members = await MemberRepo.getAll(demo.householdId);
    assertEquals(members.length, 4);
    const linked = members.find((m) => m.id === demo.memberId);
    assertEquals(linked?.isManager, true);
    assertEquals(members.some((m) => !m.isManager), true); // the kids exist
  },
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: the new case FAILS (`memberId` undefined, no members).

- [ ] **Step 4: Update the runner**

In `scripts/seed/runner.ts`:

1. Add `["members"]` to `SEED_PREFIXES`.
2. Import `MemberRepo` from `@/database/member.repo.ts`.
3. In the user-creation loop (after `HouseholdRepo.create`, before the user record is written around lines 82–95), create the members and link the first:

```ts
const memberIds: string[] = [];
for (const fixtureMember of fixtureUser.members) {
  const member = await MemberRepo.create({
    householdId: household.id,
    name: fixtureMember.name,
    color: fixtureMember.color,
    emoji: fixtureMember.emoji,
    isManager: fixtureMember.isManager,
  });
  memberIds.push(member.id);
}
```

and add `memberId: memberIds[0],` to the user `record` object literal.

- [ ] **Step 5: Run the tests**

Run: `deno test --unstable-kv -A scripts/seed/runner.test.ts`
Expected: all pass.

- [ ] **Step 6: Check, commit**

Run: `deno task check && deno task test`

```bash
git add scripts/seed/
git commit -m "feat(members): seed fixture members per household"
```

---

### Task 10: Client plumbing — `api.members`, `useMembers`, `MemberAvatar`

**Files:**
- Modify: `services/api.ts`
- Create: `hooks/useMembers.ts`
- Test: `hooks/useMembers.test.ts`
- Create: `components/members/MemberAvatar.tsx`

**Interfaces:**
- Consumes: routes from Tasks 4–5; `MemberInterface`, `MemberInput`, `UpdateMemberDto`, `resolveAvatarColor` (Task 1).
- Produces:
  - `api.members.getAll(): Promise<MemberInterface[]>`
  - `api.members.create(input: MemberInput): Promise<MemberInterface | null>`
  - `api.members.update(id: string, patch: UpdateMemberDto): Promise<MemberInterface | null>`
  - `api.members.remove(id: string): Promise<boolean>`
  - `api.members.claim(id: string): Promise<boolean>`
  - `useMembers(initial: MemberInterface[])` → `{ members, addMember, updateMember, removeMember }` (pessimistic create; optimistic update/remove with rollback; list kept name-sorted, matching `MemberRepo.getAll`)
  - `MemberAvatar({ color, emoji, size = 40 })` — colored circle + emoji, `aria-hidden`

- [ ] **Step 1: Add `api.members` to `services/api.ts`**

Add `MemberInterface, MemberInput, UpdateMemberDto` to the model imports, and inside the `api` object:

```ts
members: {
  getAll: async (): Promise<MemberInterface[]> => {
    const res = await fetch("/api/members");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (input: MemberInput): Promise<MemberInterface | null> => {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> => {
    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return res.json();
  },
  remove: async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    return res.ok;
  },
  claim: async (id: string): Promise<boolean> => {
    const res = await fetch("/api/members/acting", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id }),
    });
    return res.ok;
  },
},
```

- [ ] **Step 2: Write the failing hook tests**

`hooks/useMembers.test.ts` (mirrors `hooks/useLoyaltyCards.test.ts` — `stub` the api):

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useMembers } from "@/hooks/useMembers.ts";
import type { MemberInterface } from "@/models/index.ts";

const member = (
  id: string,
  name: string,
  isManager = false,
): MemberInterface => ({
  id,
  householdId: "h1",
  name,
  color: "sky",
  emoji: "🙂",
  isManager,
});

Deno.test("addMember — pessimistic: appends only the server-returned member, sorted", async () => {
  const created = member("new", "Bo");
  const create = stub(api.members, "create", () => Promise.resolve(created));
  const hook = useMembers([member("1", "Robin")]);
  try {
    const result = await hook.addMember({ name: "Bo", color: "sky", emoji: "🙂" });
    assertEquals(result, created);
    assertEquals(hook.members.value.map((m) => m.name), ["Bo", "Robin"]);
  } finally {
    create.restore();
  }
});

Deno.test("addMember — on failure returns null and adds nothing", async () => {
  const create = stub(api.members, "create", () => Promise.resolve(null));
  const hook = useMembers([member("1", "Robin")]);
  try {
    assertEquals(await hook.addMember({ name: "Bo", color: "sky", emoji: "🙂" }), null);
    assertEquals(hook.members.value.length, 1);
  } finally {
    create.restore();
  }
});

Deno.test("updateMember — optimistic, rolls back when the server rejects", async () => {
  const update = stub(api.members, "update", () => Promise.resolve(null));
  const hook = useMembers([member("1", "Robin", true)]);
  try {
    const saved = await hook.updateMember("1", { isManager: false });
    assertEquals(saved, null);
    assertEquals(hook.members.value[0].isManager, true); // rolled back
  } finally {
    update.restore();
  }
});

Deno.test("removeMember — optimistic, rolls back on failure", async () => {
  const remove = stub(api.members, "remove", () => Promise.resolve(false));
  const hook = useMembers([member("1", "Robin"), member("2", "Bo")]);
  try {
    const ok = await hook.removeMember("2");
    assertEquals(ok, false);
    assertEquals(hook.members.value.length, 2); // rolled back
  } finally {
    remove.restore();
  }
});
```

- [ ] **Step 3: Run to verify failure**

Run: `deno test --unstable-kv -A hooks/useMembers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `hooks/useMembers.ts`**

```ts
import { signal } from "@preact/signals";
import type {
  MemberInput,
  MemberInterface,
  UpdateMemberDto,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";

const byName = (a: MemberInterface, b: MemberInterface) =>
  a.name.localeCompare(b.name);

/**
 * Household members CRUD for islands. Same conventions as useLoyaltyCards:
 * pessimistic create (the server mints the id), optimistic update/remove with
 * snapshot rollback — callers surface failures via a snackbar (ui-ux-patterns
 * §1–§3). Instantiate once per island: `useMemo(() => useMembers(initial), [])`.
 */
export function useMembers(initial: MemberInterface[]) {
  const members = signal<MemberInterface[]>([...initial].sort(byName));

  const addMember = async (
    input: MemberInput,
  ): Promise<MemberInterface | null> => {
    const created = await api.members.create(input);
    if (created) {
      members.value = [...members.value, created].sort(byName);
    }
    return created;
  };

  const updateMember = async (
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> => {
    const snapshot = members.value;
    members.value = members.value
      .map((m) => (m.id === id ? { ...m, ...patch } : m))
      .sort(byName);
    const saved = await api.members.update(id, patch);
    if (!saved) members.value = snapshot; // rollback — caller shows a snackbar
    return saved;
  };

  const removeMember = async (id: string): Promise<boolean> => {
    const snapshot = members.value;
    members.value = members.value.filter((m) => m.id !== id);
    const ok = await api.members.remove(id);
    if (!ok) members.value = snapshot; // rollback — caller shows a snackbar
    return ok;
  };

  return { members, addMember, updateMember, removeMember };
}
```

- [ ] **Step 5: Run the hook tests**

Run: `deno test --unstable-kv -A hooks/useMembers.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Write `components/members/MemberAvatar.tsx`**

```tsx
import { resolveAvatarColor } from "@/models/index.ts";

interface MemberAvatarProps {
  color?: string;
  emoji: string;
  size?: number;
}

/** A member's face in the UI: preset colour circle + emoji. Decorative —
 *  always pair it with the member's name for screen readers. */
export function MemberAvatar(
  { color, emoji, size = 40 }: MemberAvatarProps,
) {
  const swatch = resolveAvatarColor(color);
  return (
    <span
      aria-hidden="true"
      class="grid place-items-center rounded-full select-none shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: swatch.bg,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
}
```

- [ ] **Step 7: Check, commit**

Run: `deno task check && deno task test`

```bash
git add services/api.ts hooks/useMembers.ts hooks/useMembers.test.ts components/members/
git commit -m "feat(members): client api, useMembers hook, and MemberAvatar"
```

---

### Task 11: The `/members` page

**Files:**
- Create: `routes/members/index.tsx`
- Create: `islands/members/MembersScreen.tsx`
- Modify: `islands/shell/MoreSheet.tsx` (wire the stubbed "Members" entry)

**Interfaces:**
- Consumes: `MemberRepo.getAll` (Task 1), `StateInterface.actingMember` (Task 3), `useMembers` + `MemberAvatar` (Task 10), MD3 `Sheet`/`ListItem`/`Button`/`Snackbar`/`Chip` components, `AVATAR_COLORS`/`AVATAR_EMOJIS` (Task 1).
- Produces: `/members` — everyone sees the list; managers (and self, for name/avatar) edit via a bottom sheet; managers add and remove; delete confirms in a sibling sheet; last-manager demote/remove affordances are disabled with a hint.

- [ ] **Step 1: Write the route**

`routes/members/index.tsx`:

```tsx
import { page } from "fresh";
import { MemberRepo } from "@/database/index.ts";
import MembersScreen from "@/islands/members/MembersScreen.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    ctx.state.appBar = { mode: "detail", title: "Members", backUrl: "/home" };
    const members = await MemberRepo.getAll(ctx.state.householdId!);
    return page({ members, actingMember: ctx.state.actingMember ?? null });
  },
});

export default define.page<typeof handler>(function MembersPage({ data }) {
  return (
    <main class="max-w-md mx-auto px-4">
      <MembersScreen
        initialMembers={data.members}
        actingMember={data.actingMember}
      />
    </main>
  );
});
```

- [ ] **Step 2: Write the island**

`islands/members/MembersScreen.tsx`:

```tsx
import { useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemberInterface } from "@/models/index.ts";
import { AVATAR_COLORS, AVATAR_EMOJIS, DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_EMOJI } from "@/models/index.ts";
import { useMembers } from "@/hooks/useMembers.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface Props {
  initialMembers: MemberInterface[];
  actingMember: MemberInterface | null;
}

export default function MembersScreen(
  { initialMembers, actingMember }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const { members, addMember, updateMember, removeMember } = useMemo(
    () => useMembers(initialMembers),
    [],
  );

  const canManage = actingMember?.isManager === true;

  // null = closed; "" = creating; otherwise the id being edited.
  const editingId = useSignal<string | null>(null);
  const confirmingId = useSignal<string | null>(null);
  const draftName = useSignal("");
  const draftColor = useSignal<string>(DEFAULT_AVATAR_COLOR);
  const draftEmoji = useSignal<string>(DEFAULT_AVATAR_EMOJI);
  const draftManager = useSignal(false);
  const saving = useSignal(false);

  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<number | null>(null);
  const say = (msg: string) => {
    snack.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 3000);
  };

  const managerCount = members.value.filter((m) => m.isManager).length;
  const editing = editingId.value !== null && editingId.value !== ""
    ? members.value.find((m) => m.id === editingId.value) ?? null
    : null;
  // The last manager can be neither demoted nor removed (grilled Q10).
  const lockedLastManager = editing !== null && editing.isManager &&
    managerCount <= 1;

  const openCreate = () => {
    draftName.value = "";
    draftColor.value = DEFAULT_AVATAR_COLOR;
    draftEmoji.value = DEFAULT_AVATAR_EMOJI;
    draftManager.value = false;
    editingId.value = "";
  };

  const openEdit = (m: MemberInterface) => {
    draftName.value = m.name;
    draftColor.value = m.color;
    draftEmoji.value = m.emoji;
    draftManager.value = m.isManager;
    editingId.value = m.id;
  };

  const submit = async () => {
    const name = draftName.value.trim();
    if (!name) return;
    saving.value = true;
    try {
      if (editingId.value === "") {
        const created = await addMember({
          name,
          color: draftColor.value,
          emoji: draftEmoji.value,
          isManager: draftManager.value,
        });
        if (!created) {
          say("Couldn't add that member. Try again?");
          return;
        }
      } else if (editing) {
        const saved = await updateMember(editing.id, {
          name,
          color: draftColor.value,
          emoji: draftEmoji.value,
          // Only managers may change who manages; sending it otherwise 403s.
          ...(canManage && draftManager.value !== editing.isManager
            ? { isManager: draftManager.value }
            : {}),
        });
        if (!saved) {
          say("Couldn't save those changes. Try again?");
          return;
        }
      }
      editingId.value = null;
    } finally {
      saving.value = false;
    }
  };

  const confirmRemove = async () => {
    const id = confirmingId.value;
    confirmingId.value = null;
    if (!id) return;
    const ok = await removeMember(id);
    if (!ok) say("Couldn't remove that member. Try again?");
  };

  const canEdit = (m: MemberInterface) =>
    canManage || m.id === actingMember?.id;

  return (
    <>
      <ul class="pt-2">
        {members.value.map((m) => (
          <li key={m.id}>
            <ListItem
              leading={<MemberAvatar color={m.color} emoji={m.emoji} />}
              headline={m.name}
              supporting={m.isManager ? "Manager" : undefined}
              trailing={canEdit(m)
                ? <span class="md-label-large text-primary">Edit</span>
                : undefined}
              onClick={canEdit(m) ? () => openEdit(m) : undefined}
            />
          </li>
        ))}
      </ul>

      {canManage && (
        <div class="pt-4 pb-6">
          <Button variant="filled" full onClick={openCreate}>
            Add a member
          </Button>
        </div>
      )}

      <Sheet
        open={editingId.value !== null}
        onClose={() => (editingId.value = null)}
        title={editingId.value === "" ? "New member" : "Edit member"}
      >
        <div class="flex flex-col gap-4 pb-2">
          <input
            type="text"
            value={draftName.value}
            onInput={(e) => (draftName.value = e.currentTarget.value)}
            placeholder="Name or nickname"
            aria-label="Name"
            class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
          />

          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={draftColor.value === c.key}
                aria-label={c.key}
                onClick={() => (draftColor.value = c.key)}
                class={`rounded-full ${
                  draftColor.value === c.key
                    ? "ring-2 ring-offset-2 ring-primary"
                    : ""
                }`}
                style={{ width: 36, height: 36, backgroundColor: c.bg }}
              />
            ))}
          </div>

          <div class="flex flex-wrap gap-1" role="radiogroup" aria-label="Emoji">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={draftEmoji.value === e}
                onClick={() => (draftEmoji.value = e)}
                class={`text-2xl p-1.5 rounded-full ${
                  draftEmoji.value === e ? "bg-primary-container" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {canManage && (
            <label class="flex items-center gap-3 py-1 md-body-large text-on-surface">
              <input
                type="checkbox"
                checked={draftManager.value}
                disabled={lockedLastManager}
                onChange={(e) => (draftManager.value = e.currentTarget.checked)}
                class="w-5 h-5"
              />
              Manages the household
            </label>
          )}
          {lockedLastManager && (
            <div class="md-body-medium text-on-surface-variant">
              Every household needs a manager. Promote someone else first.
            </div>
          )}

          <Button variant="filled" full loading={saving.value} onClick={submit}>
            {editingId.value === "" ? "Add" : "Save"}
          </Button>
          {canManage && editing && !lockedLastManager && (
            <Button
              variant="error"
              full
              onClick={() => {
                const id = editing.id;
                editingId.value = null;
                confirmingId.value = id;
              }}
            >
              Remove from household
            </Button>
          )}
        </div>
      </Sheet>

      {/* Confirmation is a sibling sheet — sheets never stack (house rule). */}
      <Sheet
        open={confirmingId.value !== null}
        onClose={() => (confirmingId.value = null)}
        title="Remove this member?"
      >
        <div class="flex flex-col gap-3 pb-2">
          <div class="md-body-medium text-on-surface-variant">
            Their name and avatar are gone for good. Things they added stay.
          </div>
          <Button variant="error" full onClick={confirmRemove}>Remove</Button>
          <Button
            variant="text"
            full
            onClick={() => (confirmingId.value = null)}
          >
            Keep them
          </Button>
        </div>
      </Sheet>

      <Snackbar data={snack.value} />
    </>
  );
}
```

**Note:** verify the exact props of `Sheet`, `ListItem`, `Button`, and `Snackbar` against their source in `components/md3/` before finishing — e.g. `Button`'s variant names (`filled`/`error`/`text` are used by `islands/todos/TodoBacklog.tsx:515-560`) and `ListItem`'s `headline`/`supporting`/`leading`/`trailing`/`onClick` (used by `islands/shell/MoreSheet.tsx:38-88`). Match what exists; do not invent props.

- [ ] **Step 3: Wire the More sheet**

In `islands/shell/MoreSheet.tsx`, replace the stubbed Members entry (lines 77–82):

```tsx
<ListItem
  leading={badge("people")}
  headline="Members"
  trailing={chevron()}
  onClick={() => {
    onClose();
    navigateTo("/members");
  }}
/>
```

- [ ] **Step 4: Verify in the browser**

Run the dev server (`.claude/launch.json` config via the preview tool), log in as the seeded `demo` user, open More → Members:
- All four members listed alphabetically with avatars; "Manager" under Demo and Robin.
- Add a member → appears in the list (server-minted id).
- Edit Bo's emoji → saves; break the network (dev tools offline) → rollback + snackbar.
- Demote Demo while Robin is still a manager → saves. Then demote Robin as the last manager → checkbox disabled with the hint.
- Remove Pip → confirm sheet → gone.

- [ ] **Step 5: Check, commit**

Run: `deno task check && deno task test`

```bash
git add routes/members/ islands/members/ islands/shell/MoreSheet.tsx
git commit -m "feat(members): /members management page"
```

---

### Task 12: The acting-member chip and picker

**Files:**
- Create: `islands/shell/ActingMemberChip.tsx` (a component inside the AppChrome island tree — not its own island)
- Modify: `islands/shell/AppChrome.tsx`
- Modify: `routes/_app.tsx`

**Interfaces:**
- Consumes: `StateInterface.actingMember`/`actingClaimed` (Task 3), `api.members.getAll`/`claim` (Task 10), `MemberAvatar` (Task 10), MD3 `Sheet`/`ListItem`/`Pressable`, `reloadPage` from `@/utils/loading.ts` (exists per ui-ux-patterns §4 — verify the export name in `utils/loading.ts` before using).
- Produces: an avatar chip in the TopAppBar's trailing slot on **every** screen (section and detail modes). Tap → picker sheet → claim → full reload (so SSR-derived manager gating everywhere reflects the new acting member). Unclaimed devices self-heal: one member → silent auto-claim; several → the picker auto-opens once.

- [ ] **Step 1: Write `islands/shell/ActingMemberChip.tsx`**

```tsx
import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemberInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { reloadPage } from "@/utils/loading.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface Props {
  actingMember: MemberInterface | null;
  /** True when a valid device cookie made the claim (vs. the login fallback). */
  claimed: boolean;
}

/**
 * The always-visible "who am I" chip (grilled Q6/Q12): seeing the wrong
 * avatar is how a family self-corrects attribution under the honor system.
 * Unclaimed devices self-heal on mount: a sole member is claimed silently; a
 * real choice auto-opens the picker once.
 */
export default function ActingMemberChip({ actingMember, claimed }: Props) {
  const open = useSignal(false);
  const acting = useSignal<MemberInterface | null>(actingMember);
  const members = useSignal<MemberInterface[] | null>(null);

  const load = async () => {
    if (members.value === null) members.value = await api.members.getAll();
  };

  useEffect(() => {
    if (claimed) return;
    (async () => {
      await load();
      const ms = members.value ?? [];
      if (ms.length === 1) {
        // Sole member: nothing to choose — claim silently (Q6).
        if (await api.members.claim(ms[0].id)) acting.value = ms[0];
      } else if (ms.length > 1) {
        open.value = true;
      }
    })();
  }, []);

  const pick = async (m: MemberInterface) => {
    const ok = await api.members.claim(m.id);
    if (!ok) return; // sheet stays open; nothing changed
    open.value = false;
    // Full reload: manager gating and attribution are server-resolved, so
    // every screen must re-render under the new acting member.
    reloadPage();
  };

  return (
    <>
      <Pressable
        aria-label="Switch member"
        onClick={() => {
          load();
          open.value = true;
        }}
        class="grid place-items-center rounded-full"
        style={{ width: 40, height: 40 }}
      >
        {acting.value
          ? (
            <MemberAvatar
              color={acting.value.color}
              emoji={acting.value.emoji}
              size={32}
            />
          )
          : <Icon name="people" size={22} />}
      </Pressable>
      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Who's using Happie?"
      >
        {(members.value ?? []).map((m) => (
          <ListItem
            key={m.id}
            leading={<MemberAvatar color={m.color} emoji={m.emoji} />}
            headline={m.name}
            supporting={m.isManager ? "Manager" : undefined}
            trailing={acting.value?.id === m.id
              ? <span class="md-label-large text-primary">That's me</span>
              : undefined}
            onClick={() => pick(m)}
          />
        ))}
      </Sheet>
    </>
  );
}
```

(Verify `Pressable`'s accepted props against `components/md3/Pressable.tsx` — it hosts keyboard a11y for non-button hosts; adjust to its actual API.)

- [ ] **Step 2: Thread the state through `routes/_app.tsx` and `AppChrome`**

`routes/_app.tsx` — extend the AppChrome call:

```tsx
{state?.userId && (
  <AppChrome
    activeId={activeTab?.id}
    appBar={state.appBar}
    sectionTitle={activeTab?.label ?? "Happie"}
    actingMember={state.actingMember ?? null}
    actingClaimed={state.actingClaimed === true}
  />
)}
```

`islands/shell/AppChrome.tsx` — extend the props and render the chip in both app-bar modes:

```tsx
import ActingMemberChip from "./ActingMemberChip.tsx";
import type { MemberInterface } from "@/models/index.ts";

interface AppChromeProps {
  activeId?: string;
  appBar?: AppBar;
  sectionTitle: string;
  actingMember: MemberInterface | null;
  actingClaimed: boolean;
}
```

Inside the component (before the return), build the chip once:

```tsx
const chip = (
  <ActingMemberChip actingMember={actingMember} claimed={actingClaimed} />
);
```

Then pass it as/into `trailing` for **both** TopAppBar renders — detail mode combines it with any page action:

```tsx
{detail
  ? (
    <TopAppBar
      title={detail.title}
      backUrl={detail.backUrl}
      trailing={
        <>
          {appBarAction.value && (
            <IconButton
              name={appBarAction.value.icon}
              aria-label={appBarAction.value.label}
              onClick={appBarAction.value.onClick}
            />
          )}
          {chip}
        </>
      }
    />
  )
  : <TopAppBar title={sectionTitle} trailing={chip} />}
```

Note the full-screen `mode: "none"` branch stays chip-less by design (those routes own the whole viewport).

- [ ] **Step 3: Verify in the browser**

With the seeded `demo` household (4 members):
- Fresh login (clear the `actingMemberId` cookie): the picker auto-opens; pick Bo; page reloads; the chip shows Bo's 🐸.
- Reload → no picker (claimed), chip still Bo.
- Tap the chip → picker lists all four, "That's me" on Bo; switch to Demo → reload → chip shows 🦊.
- As Bo (non-manager): `/members` shows no "Add a member" button and no Edit on others (only on Bo).
- Delete the cookie and log in as `alex` (single member): no picker; chip auto-claims Alex silently.

- [ ] **Step 4: Check, commit**

Run: `deno task check && deno task test`

```bash
git add islands/shell/ActingMemberChip.tsx islands/shell/AppChrome.tsx routes/_app.tsx
git commit -m "feat(members): acting-member chip with per-device picker"
```

---

### Task 13: Hide destructive affordances from non-managers

The server 403 (Task 6) is the backstop; this task makes the UI honest — non-managers simply don't see delete buttons (grilled Q5/Q13). Four islands render destructive affordances today; each gets a `canDelete: boolean` prop from its SSR route: `canDelete: ctx.state.actingMember?.isManager === true`.

**Files:**
- Modify: `routes/todos/index.tsx` + `islands/todos/TodoBacklog.tsx`
- Modify: `routes/cards/index.tsx` + `islands/cards/LoyaltyWallet.tsx`
- Modify: `routes/shopping/catalogue/index.tsx` + `islands/catalogue.tsx`
- Modify: `routes/menu/[id]/index.tsx` + `islands/dishes/DishEditor.tsx`

**Interfaces:**
- Consumes: `StateInterface.actingMember` (Task 3).
- Produces: each island gains a required `canDelete: boolean` prop; delete affordances render only when true.

- [ ] **Step 1: To-dos**

`routes/todos/index.tsx`:

```tsx
export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    return page({
      todos: await TodoRepo.getAll(householdId),
      canDelete: ctx.state.actingMember?.isManager === true,
    });
  },
});

export default define.page<typeof handler>(function Todos({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <TodoBacklog initialTodos={data.todos} canDelete={data.canDelete} />
    </main>
  );
});
```

`islands/todos/TodoBacklog.tsx`: add `canDelete: boolean;` to its `Props` interface and to the destructure (`{ initialTodos, canDelete }`). Wrap the editor sheet's Delete button — the `<Button variant="error" ...>` whose onClick sets `confirmingId.value = id` (~line 516–527) — in `{canDelete && ( ... )}`. The confirm sheet itself (line ~533) can stay; it never opens when the trigger is hidden.

- [ ] **Step 2: Loyalty cards**

`routes/cards/index.tsx`: add `canDelete: ctx.state.actingMember?.isManager === true` to the `page({...})` data and pass `canDelete={data.canDelete}` to `<LoyaltyWallet>`.

`islands/cards/LoyaltyWallet.tsx`: add `canDelete: boolean;` to `Props`, destructure it, and pass it down to where the delete affordance renders. `handleDelete` (line ~121) is invoked from `CardForm` — thread the prop into `CardForm` (`components/cards/CardForm.tsx`) and render its delete button only when true (find the button that calls the form's delete callback; wrap it in `{canDelete && ...}`).

- [ ] **Step 3: Catalogue (category delete)**

`routes/shopping/catalogue/index.tsx`: add `canDelete` to the page data as above and thread it into the `islands/catalogue.tsx` island's props. In `islands/catalogue.tsx`, gate the affordance that calls `deleteCategory(...)` (line ~328) behind the new `canDelete` prop.

- [ ] **Step 4: Dish editor**

`routes/menu/[id]/index.tsx`: add `canDelete` to the page data and thread it into `DishEditor`'s props. In `islands/dishes/DishEditor.tsx`, gate the Delete button whose handler calls `api.dishes.delete(dish.id)` (line ~93) behind `canDelete`.

- [ ] **Step 5: Verify in the browser**

As Bo (non-manager): the to-do editor sheet has no Delete button; a card's edit form has no delete; the catalogue's category editor has no delete; a dish page has no delete. As Demo (manager): all four are back.

- [ ] **Step 6: Check, run all tests, commit**

Run: `deno task check && deno task test`
Expected: green — update any island test fixtures that now require the `canDelete` prop (e.g. `islands/todos/TodoBacklog.test.tsx` renders the island; pass `canDelete` in both true/false variants where relevant).

```bash
git add routes/ islands/ components/cards/
git commit -m "feat(members): hide destructive affordances from non-managers"
```

---

### Task 14: Docs, full verification, and wrap-up

**Files:**
- Modify: `docs/ui-ux-patterns.md`
- Verify: everything, end to end

- [ ] **Step 1: Document the new pattern**

Append a §15 to `docs/ui-ux-patterns.md` in the house shape (Rule → Why → How → See):

```markdown
## 15. Acting member: attribution, manager gating, and the chip

**Rule:** Every request acts as a **member** (`ctx.state.actingMember`),
resolved by the auth middleware from the device's `actingMemberId` cookie
(falling back to the login's linked member). Stamp attribution
(`createdBy`) with the acting member's id. Destructive endpoints call
`requireManager(ctx)` and return its 403 when set; the UI additionally
hides destructive affordances behind a `canDelete` prop derived from
`ctx.state.actingMember?.isManager`. The avatar chip in the top app bar is
always visible so a wrong identity is noticed and switched in one tap.

**Why:** Members are people, users are credentials, and the claim is honor
system — a guardrail against curious kids, not a security boundary (see
docs/adr/0006). Hiding the buttons prevents the accidental case; the server
403 backstops the rest. Never present a "kids can't X" rule as security.

**How:** server: `requireManager` (utils/manager.ts) after the auth guard;
routes pass `canDelete: ctx.state.actingMember?.isManager === true` into
islands. Client: `api.members.claim(id)` sets the device cookie; a full
`reloadPage()` after switching re-renders everything under the new member.

**See:** `routes/_middleware.ts` (resolution), `utils/manager.ts`,
`islands/shell/ActingMemberChip.tsx`, `routes/api/members/`,
`docs/adr/0006-members-are-people-users-are-credentials.md`.
```

- [ ] **Step 2: Full local verification**

```bash
deno task check && deno task test
```

Expected: everything green. Then reseed and click through the whole feature once more in the browser (`deno task db:seed`, dev server, login as `demo`): picker → switch → members CRUD → last-manager lockout → non-manager hiding → a kid's DELETE via devtools fetch returns 403.

- [ ] **Step 3: Migration dry-run note**

Do **not** run `scripts/migrate.ts` against production as part of this work. Per `docs/running-migrations.md`, migrations are run manually against production after deploy. Verify locally instead: run `deno task db:seed`, then manually blank one user's `memberId` and a todo's `createdBy` via a scratch script if desired, run `deno task db:migrate` (requires `SEED_PASSWORD` in `.env`), and confirm the summary line reports members created / createdBy rewritten.

- [ ] **Step 4: Commit docs**

```bash
git add docs/ui-ux-patterns.md
git commit -m "docs: document acting-member attribution and manager gating patterns"
```

- [ ] **Step 5: Finish the branch**

Use the finishing-a-development-branch skill: push, open a PR against `main` with `Closes #17`, summarizing: Netflix-model members (ADR 0006), acting-member cookie + chip, manager gating (six endpoints), attribution switch + migration, `/members` page, seed/fixtures.

---

## Self-Review (done at planning time)

- **Spec coverage:** issue #17's acceptance criteria — add/edit/remove member profiles (Tasks 4, 11); name + minimal details (Task 1; age deliberately omitted per grilling, recorded in the model's doc comment); managers add/edit/delete (Tasks 4, 6); UI reachable from settings (Task 11 — the More sheet's Household section); permission enforcement (Tasks 4, 6 — honor-system caveat in ADR 0006); KV repository patterns (Task 1). Grilled additions beyond the issue: acting-member claim + chip (Tasks 3, 5, 12), attribution rewrite (Tasks 7–8), gated existing endpoints (Task 6), affordance hiding (Task 13), seeds (Task 9).
- **Type consistency:** `MemberInterface`/`CreateMemberDto`/`UpdateMemberDto`/`MemberInput` (Task 1) are the only member types used throughout; `requireManager` defined once (Task 4) and reused (Task 6); `api.members.*` signatures (Task 10) match the routes (Tasks 4–5); `canDelete` prop name is uniform (Task 13); sorting comparator (`localeCompare` on name) is identical in `MemberRepo.getAll` and `useMembers`.
- **Known judgment calls for the implementer:** exact MD3 component props (`Sheet`, `ListItem`, `Button`, `Pressable`, `Snackbar`) must be checked against their source before use — the plan's usage mirrors existing call sites (`MoreSheet`, `TodoBacklog`) but props are not re-verified here. Same for the `reloadPage` export in `utils/loading.ts`.
