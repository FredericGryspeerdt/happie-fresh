# Sliding Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sessions slide to now + 30 days on activity (capped at 90 days from login) so active users stop being logged out every 24 hours, and the session cookie becomes `HttpOnly`.

**Architecture:** The session model gains an `absoluteExpiresAt` field. `SessionRepo` gains a `touch()` method that extends the sliding expiry with at most one KV write per session per day. The auth middleware calls `touch()` after serving each authenticated request and re-issues the cookie when a renewal happened. Cookie attributes move to one shared helper used by login and middleware. Spec: `docs/superpowers/specs/2026-08-07-sliding-sessions-design.md`.

**Tech Stack:** Deno + Fresh 2, Deno KV (sessions stored under `["sessions", id]` with `expireIn` TTL), `$std/http/cookie.ts` (std 0.216.0), `jsr:@std/assert@^1.0.19` for tests.

## Global Constraints

- Idle window: **30 days** (`SESSION_IDLE_TTL_MS`); absolute cap: **90 days** (`SESSION_ABSOLUTE_TTL_MS`); renewal write throttle: **1 day** (`RENEWAL_THRESHOLD_MS`). All private to `session.repo.ts` except `SESSION_IDLE_TTL_MS`, which login needs.
- Cookie attributes everywhere: name `sessionId`, host-only (**no `domain`** — see comment in `routes/logout.ts`), `path: "/"`, `secure: true`, `sameSite: "Lax"`, `httpOnly: true`.
- Session IDs never rotate on renewal.
- Legacy sessions (no `absoluteExpiresAt`) are never renewed; no data migration.
- Renewal is best-effort: a failed `touch()` must never fail the request.
- Imports use the `@/` alias; JSX/Tailwind not involved. Run `deno fmt` before each commit (the check task runs `deno fmt --check`).
- Commits follow Conventional Commits.
- Tests run with `deno task test` (equivalent to `deno test --unstable-kv -A`); KV-backed tests set `Deno.env.set("KV_PATH", ":memory:")` at module top and use `sanitizeResources: false` (see `database/loyalty-card.repo.test.ts` for the established pattern).

---

### Task 1: Sliding expiry in SessionRepo

**Files:**
- Modify: `models/session/session.interface.ts`
- Modify: `database/session.repo.ts`
- Test: `database/session.repo.test.ts` (new)

**Interfaces:**
- Consumes: `getKv()` from `@/database/db.ts`; `SessionInterface` from `@/models/index.ts`.
- Produces (used by Tasks 2 and 3):
  - `SessionInterface` gains `absoluteExpiresAt?: Date` (optional: legacy sessions lack it).
  - `SessionRepo.create(userId: string): Promise<SessionInterface>` — `expiresAt` = now + 30d, `absoluteExpiresAt` = now + 90d.
  - `SessionRepo.touch(session: SessionInterface): Promise<SessionInterface | null>` — returns the renewed session after a KV write, or `null` when no write happened (throttled, capped-out, or legacy).
  - `export const SESSION_IDLE_TTL_MS` (30 days in ms).

- [ ] **Step 1: Write the failing tests**

Create `database/session.repo.test.ts`:

```ts
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1.0.19";
import { SESSION_IDLE_TTL_MS, SessionRepo } from "@/database/session.repo.ts";
import { getKv } from "@/database/db.ts";
import { SessionInterface } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

const DAY_MS = 1000 * 60 * 60 * 24;
// Tolerance for "was computed from Date.now()" assertions.
const CLOCK_SLACK_MS = 5_000;

async function clearSessions() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["sessions"] })) {
    await kv.delete(e.key);
  }
}

// Overwrite a session in KV directly to simulate age/legacy shapes.
async function putSession(session: SessionInterface) {
  const kv = await getKv();
  await kv.set(["sessions", session.id], session);
}

Deno.test({
  name: "create — sets sliding expiry 30d out and absolute cap 90d out",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    assertEquals(SESSION_IDLE_TTL_MS, 30 * DAY_MS);
    assertAlmostEquals(
      new Date(session.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    assertAlmostEquals(
      new Date(session.absoluteExpiresAt!).getTime(),
      Date.now() + 90 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    const fetched = await SessionRepo.findById(session.id);
    assertEquals(fetched?.userId, "user-1");
  },
});

Deno.test({
  name: "touch — slides expiry back out to 30d and persists it",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    // Simulate a session last renewed 2 days ago: expiry sits at now + 28d.
    const aged = { ...session, expiresAt: new Date(Date.now() + 28 * DAY_MS) };
    await putSession(aged);

    const renewed = await SessionRepo.touch(aged);

    assertEquals(renewed !== null, true);
    assertAlmostEquals(
      new Date(renewed!.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
    const persisted = await SessionRepo.findById(session.id);
    assertAlmostEquals(
      new Date(persisted!.expiresAt).getTime(),
      Date.now() + 30 * DAY_MS,
      CLOCK_SLACK_MS,
    );
  },
});

Deno.test({
  name: "touch — never extends past absoluteExpiresAt",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const session = await SessionRepo.create("user-1");
    // Near end of life: cap 10d away, sliding expiry down to 5d.
    const absolute = new Date(Date.now() + 10 * DAY_MS);
    const aged = {
      ...session,
      expiresAt: new Date(Date.now() + 5 * DAY_MS),
      absoluteExpiresAt: absolute,
    };
    await putSession(aged);

    const renewed = await SessionRepo.touch(aged);

    assertEquals(
      new Date(renewed!.expiresAt).getTime(),
      absolute.getTime(),
    );
  },
});

Deno.test({
  name: "touch — skips the write when less than a day would be gained",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    // Freshly created: expiry already at now + 30d, nothing to gain.
    const session = await SessionRepo.create("user-1");

    const renewed = await SessionRepo.touch(session);

    assertEquals(renewed, null);
    const persisted = await SessionRepo.findById(session.id);
    assertEquals(
      new Date(persisted!.expiresAt).getTime(),
      new Date(session.expiresAt).getTime(),
    );
  },
});

Deno.test({
  name: "touch — never renews legacy sessions without absoluteExpiresAt",
  sanitizeResources: false,
  async fn() {
    await clearSessions();
    const legacy: SessionInterface = {
      id: crypto.randomUUID(),
      userId: "user-1",
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h left
    };
    await putSession(legacy);

    const renewed = await SessionRepo.touch(legacy);

    assertEquals(renewed, null);
    const persisted = await SessionRepo.findById(legacy.id);
    assertEquals(
      new Date(persisted!.expiresAt).getTime(),
      new Date(legacy.expiresAt).getTime(),
    );
  },
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno task test database/session.repo.test.ts`
Expected: FAIL — `SESSION_IDLE_TTL_MS` is not an exported member / `SessionRepo.touch is not a function`. (The `create` test also fails on the missing `absoluteExpiresAt`.)

- [ ] **Step 3: Implement the model field and repo logic**

Replace the body of `models/session/session.interface.ts` with:

```ts
export interface SessionInterface {
  id: string;
  userId: string;
  // Sliding idle expiry: renewed to now + 30d on activity, capped at
  // absoluteExpiresAt.
  expiresAt: Date;
  // Hard ceiling fixed at login (login + 90d). Optional: sessions created
  // before sliding expiry lack it and are never renewed.
  absoluteExpiresAt?: Date;
}
```

Replace the body of `database/session.repo.ts` with:

```ts
import { getKv } from "./db.ts";
import { SessionInterface } from "@/models/index.ts";

// Sliding idle window: a session dies after this long without activity.
export const SESSION_IDLE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
// Hard ceiling from login, regardless of activity.
const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
// Skip the KV write unless the expiry would move by more than this.
const RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 1 day

export class SessionRepo {
  static async create(userId: string): Promise<SessionInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: SessionInterface = {
      id,
      userId,
      expiresAt: new Date(now + SESSION_IDLE_TTL_MS),
      absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_TTL_MS),
    };

    await kv.set(["sessions", id], session, {
      expireIn: SESSION_IDLE_TTL_MS,
    });
    return session;
  }

  /**
   * Slide the session's expiry to now + 30d (capped at absoluteExpiresAt).
   * Returns the renewed session, or null when nothing was written: the
   * expiry would move by less than a day (throttle — at most one write per
   * session per day), or the session predates sliding expiry.
   */
  static async touch(
    session: SessionInterface,
  ): Promise<SessionInterface | null> {
    if (!session.absoluteExpiresAt) return null;

    const now = Date.now();
    const newExpiry = Math.min(
      now + SESSION_IDLE_TTL_MS,
      new Date(session.absoluteExpiresAt).getTime(),
    );
    const gained = newExpiry - new Date(session.expiresAt).getTime();
    if (gained <= RENEWAL_THRESHOLD_MS) return null;

    const renewed: SessionInterface = {
      ...session,
      expiresAt: new Date(newExpiry),
    };
    const kv = await getKv();
    await kv.set(["sessions", session.id], renewed, {
      expireIn: newExpiry - now,
    });
    return renewed;
  }

  static async findById(id: string): Promise<SessionInterface | null> {
    const kv = await getKv();
    const session = await kv.get<SessionInterface>(["sessions", id]);
    return session.value;
  }

  static async delete(id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["sessions", id]);
  }
}
```

Note the old `SESSION_TTL_MS` constant is gone; nothing else imported it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno task test database/session.repo.test.ts`
Expected: PASS — 5 tests.

Also run the full suite to catch fallout in other KV tests: `deno task test`
Expected: PASS.

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt models/session/session.interface.ts database/session.repo.ts database/session.repo.test.ts
deno task check
git add models/session/session.interface.ts database/session.repo.ts database/session.repo.test.ts
git commit -m "feat(auth): add sliding session expiry with 90-day absolute cap"
```

---

### Task 2: Shared session cookie helper; login sets 30-day HttpOnly cookie

**Files:**
- Create: `utils/session-cookie.ts`
- Modify: `utils/index.ts` (add barrel export)
- Modify: `routes/login.tsx:37-50` (use the helper)
- Modify: `routes/logout.ts` (comment pointer only)
- Test: `utils/session-cookie.test.ts` (new)

**Interfaces:**
- Consumes: `setCookie` from `$std/http/cookie.ts`; `SESSION_IDLE_TTL_MS` and `SessionRepo` from `@/database/index.ts` (Task 1; `database/index.ts` already re-exports `session.repo.ts` with `export *`).
- Produces (used by Task 3): `setSessionCookie(headers: Headers, sessionId: string, maxAgeSeconds: number): void`, exported from `@/utils/index.ts`.

- [ ] **Step 1: Write the failing test**

Create `utils/session-cookie.test.ts`:

```ts
import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.19";
import { setSessionCookie } from "@/utils/session-cookie.ts";

Deno.test("setSessionCookie — sets a secure, HttpOnly, host-only cookie", () => {
  const headers = new Headers();
  setSessionCookie(headers, "abc-123", 2_592_000);

  const cookie = headers.get("set-cookie")!;
  assertMatch(cookie, /^sessionId=abc-123;/);
  assertMatch(cookie, /Max-Age=2592000/i);
  assertMatch(cookie, /HttpOnly/i);
  assertMatch(cookie, /Secure/i);
  assertMatch(cookie, /SameSite=Lax/i);
  assertMatch(cookie, /Path=\//i);
  // Host-only: no Domain attribute (see the comment in the helper).
  assertEquals(/Domain=/i.test(cookie), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno task test utils/session-cookie.test.ts`
Expected: FAIL — module `utils/session-cookie.ts` not found.

- [ ] **Step 3: Implement the helper and barrel export**

Create `utils/session-cookie.ts`:

```ts
import { setCookie } from "$std/http/cookie.ts";

/**
 * The single place that knows the session cookie's attributes. Login and
 * the auth middleware both go through here; routes/logout.ts must keep its
 * deleteCookie attributes in sync with these.
 */
export function setSessionCookie(
  headers: Headers,
  sessionId: string,
  maxAgeSeconds: number,
): void {
  setCookie(headers, {
    name: "sessionId",
    value: sessionId,
    maxAge: maxAgeSeconds,
    sameSite: "Lax",
    // No `domain`: a host-only cookie is scoped to whatever host served it,
    // which is what we want. Pinning it to `ctx.url.hostname` broke on-device
    // testing — behind the Fresh Vite plugin the inner request URL is always
    // localhost, so a phone hitting the LAN address got `Domain=localhost`
    // and the browser silently rejected the cookie (endless login loop).
    path: "/",
    secure: true,
    // HttpOnly keeps XSS away from the session ID, and exempts the cookie
    // from Safari ITP's 7-day purge of script-writable storage (matters for
    // the iOS PWA).
    httpOnly: true,
  });
}
```

Add to `utils/index.ts`:

```ts
export * from "./session-cookie.ts";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno task test utils/session-cookie.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Use the helper in login**

In `routes/login.tsx`, change the imports (drop `setCookie`, pull in the helper and TTL):

```ts
import { page } from "fresh";
import { SESSION_IDLE_TTL_MS, SessionRepo, UserRepo } from "@/database/index.ts";
import { define, setSessionCookie, verifyPassword } from "@/utils/index.ts";
```

Replace the cookie block in the POST handler (currently the `setCookie(headers, { name: "sessionId", ... })` call at lines 37–50, including the maxAge and host-only comments, which now live in the helper) with:

```ts
    // Create session
    const session = await SessionRepo.create(user.id);

    const headers = new Headers();
    setSessionCookie(headers, session.id, SESSION_IDLE_TTL_MS / 1000);
```

In `routes/logout.ts`, update the comment that says "Must mirror the attributes used in routes/login.tsx" to point at the new home:

```ts
    // Must mirror the attributes used in utils/session-cookie.ts — a
    // host-only cookie is only cleared by a host-only delete, so no
    // `domain` here either.
```

- [ ] **Step 6: Check and run the suite**

Run: `deno task check && deno task test`
Expected: both PASS (unused-import lint would fail here if `setCookie` were left behind in login.tsx).

- [ ] **Step 7: Commit**

```bash
git add utils/session-cookie.ts utils/session-cookie.test.ts utils/index.ts routes/login.tsx routes/logout.ts
git commit -m "feat(auth): set 30-day HttpOnly session cookie via shared helper"
```

---

### Task 3: Middleware renews sessions and re-issues the sliding cookie

**Files:**
- Modify: `routes/_middleware.ts:29-41`
- Test: `tests/middleware.test.ts` (new top-level `tests/` dir — do NOT put test files inside `routes/`, where the router scans; `deno task test` discovers `*.test.ts` anywhere)

**Interfaces:**
- Consumes: `SessionRepo.create` / `SessionRepo.touch` (Task 1), `setSessionCookie` from `@/utils/index.ts` (Task 2), existing `handler` export of `routes/_middleware.ts`.
- Produces: no new exports — behavior change only (authenticated responses carry a renewed `Set-Cookie` when `touch()` wrote).

- [ ] **Step 1: Write the failing tests**

Create `tests/middleware.test.ts`:

```ts
import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/_middleware.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

const DAY_MS = 1000 * 60 * 60 * 24;

// The middleware only touches ctx.req, ctx.state, and ctx.next().
function fakeCtx(req: Request) {
  return {
    req,
    state: {},
    next: () => Promise.resolve(new Response("ok")),
  } as unknown as Parameters<typeof handler>[0];
}

function pageRequest(sessionId: string) {
  return new Request("http://localhost:8000/shopping", {
    headers: { cookie: `sessionId=${sessionId}` },
  });
}

Deno.test({
  name: "middleware — re-issues the cookie when the session is renewed",
  sanitizeResources: false,
  async fn() {
    const session = await SessionRepo.create("user-1");
    // Age the session so touch() has more than a day to gain.
    const kv = await getKv();
    const aged = { ...session, expiresAt: new Date(Date.now() + 28 * DAY_MS) };
    await kv.set(["sessions", session.id], aged);

    const response = await handler(fakeCtx(pageRequest(session.id)));

    assertEquals(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assertMatch(cookie, new RegExp(`^sessionId=${session.id};`));
    assertMatch(cookie, /HttpOnly/i);
    // Max-Age slid back out to ~30 days.
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)![1]);
    assertEquals(maxAge > 29 * 24 * 60 * 60, true);
    assertEquals(maxAge <= 30 * 24 * 60 * 60, true);
  },
});

Deno.test({
  name: "middleware — no Set-Cookie when renewal is throttled",
  sanitizeResources: false,
  async fn() {
    // Fresh session: expiry already at now + 30d, touch() returns null.
    const session = await SessionRepo.create("user-1");

    const response = await handler(fakeCtx(pageRequest(session.id)));

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("set-cookie"), null);
  },
});

Deno.test({
  name: "middleware — unknown session still redirects pages to /login",
  sanitizeResources: false,
  async fn() {
    const response = await handler(fakeCtx(pageRequest("no-such-session")));

    assertEquals(response.status, 303);
    assertEquals(response.headers.get("location"), "/login");
  },
});

Deno.test({
  name: "middleware — unknown session still gets 401 on /api",
  sanitizeResources: false,
  async fn() {
    const req = new Request("http://localhost:8000/api/items", {
      headers: { cookie: "sessionId=no-such-session" },
    });

    const response = await handler(fakeCtx(req));

    assertEquals(response.status, 401);
  },
});
```

- [ ] **Step 2: Run the tests to verify the new behavior fails**

Run: `deno task test tests/middleware.test.ts`
Expected: the first test ("re-issues the cookie when the session is renewed") FAILS — no `Set-Cookie` is ever set today, so its `assertMatch` receives `null`. The other three pass against current behavior (the throttle test trivially so); the first test's failure is the red step.

- [ ] **Step 3: Implement the renewal in the middleware**

In `routes/_middleware.ts`, add the import:

```ts
import { setSessionCookie } from "@/utils/index.ts";
```

Replace the session-check block (currently lines 33–41, `if (sessionId) { ... }`) with:

```ts
  if (sessionId) {
    const session = await SessionRepo.findById(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      const user = await UserRepo.findById(session.userId);
      ctx.state.userId = session.userId;
      ctx.state.householdId = user?.householdId;

      const response = await ctx.next();

      try {
        const renewed = await SessionRepo.touch(session);
        if (renewed) {
          const maxAge = Math.floor(
            (new Date(renewed.expiresAt).getTime() - Date.now()) / 1000,
          );
          setSessionCookie(response.headers, renewed.id, maxAge);
        }
      } catch {
        // Renewal is best-effort — the session stays valid until its
        // current expiresAt, so never fail the request over it.
      }

      return response;
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno task test tests/middleware.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Format, check, run the full suite, commit**

```bash
deno fmt routes/_middleware.ts tests/middleware.test.ts
deno task check
deno task test
git add routes/_middleware.ts tests/middleware.test.ts
git commit -m "feat(auth): renew sessions in middleware and re-issue sliding cookie"
```

---

### Task 4: End-to-end verification against the dev server

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: everything above, `deno task dev`, `deno task db:seed` (demo user credentials come from `.env`).

- [ ] **Step 1: Full local gate**

Run: `deno task check && deno task test`
Expected: both PASS.

- [ ] **Step 2: Verify the login cookie over HTTP**

Start the dev server (`deno task dev`, seeded via `deno task db:seed` if needed; demo credentials are in `.env`). Then:

```bash
curl -sik -X POST http://localhost:8000/login \
  --data-urlencode "username=<demo username from .env>" \
  --data-urlencode "password=<demo password from .env>" \
  | grep -i "^set-cookie"
```

Expected: one `Set-Cookie: sessionId=...` line containing `Max-Age=2592000`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and **no** `Domain=`.

(Note: the cookie is `Secure` but plain-HTTP localhost still works — browsers and curl accept Secure cookies on localhost; this matches current behavior.)

- [ ] **Step 3: Verify a normal authenticated request does not re-issue the cookie**

Using the `sessionId` value from Step 2:

```bash
curl -si http://localhost:8000/shopping -H "Cookie: sessionId=<value>" | grep -i "^set-cookie" || echo "no set-cookie (expected)"
```

Expected: `no set-cookie (expected)` — a freshly created session is inside the one-day throttle. (Renewal-path behavior is covered by `tests/middleware.test.ts`; it can't be observed here without backdating the session in KV.)

- [ ] **Step 4: Report**

No commit. Report the curl output in the task summary as evidence.
