# To-do Notifications Implementation Plan (iteration 4a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a to-do's due moment arrives, every device in the household gets a push notification.

**Architecture:** A `Deno.cron` sweep every five minutes scans open dated to-dos, **atomically claims a marker** per fire-point, then sends one notification per to-do to that household's stored push subscriptions. A minimal push-only service worker displays them. Permission is only ever requested from a user gesture.

**Tech Stack:** Deno, Fresh 2, Preact + `@preact/signals`, Deno KV, `Deno.cron`, `npm:web-push`, Web Push / VAPID, a hand-written service worker.

**Spec:** [`docs/superpowers/specs/2026-08-05-todo-notifications-design.md`](../specs/2026-08-05-todo-notifications-design.md)
**Decision of record:** [ADR 0005](../../adr/0005-push-delivery-is-a-claim-based-cron-sweep.md) — push delivery is a claim-based cron sweep

## Before you start

Baseline on `feature/todo-notifications` (off `main` at `613678c`): `deno task check` passes, `deno task test` reports **324 passed**. If `deno check` complains about missing npm packages, run `deno install` once. If your baseline differs, find out why before starting.

**Task 1 is a spike and gates everything else.** Do not implement Tasks 2+ until it has answered its question.

## Global Constraints

- **Deno + Fresh 2.** Handlers are `define.handlers({...})` with `define` from `@/utils/index.ts`; context type is `Context` from `"fresh"`, never `FreshContext`.
- **Imports use the `@/` alias.** Repos from `@/database/index.ts`, models from `@/models/index.ts`, HTTP helpers (`json`, `noContent`, `badRequest`, `notFound`) from `@/utils/index.ts`.
- **JSX is `precompile`** — write `class`, never `className`.
- **Never call `Deno.openKv()` directly** — always `getKv()` from `@/database/db.ts`.
- **Signals:** hooks create state with `signal()` at hook-body level; islands call hooks inside `useMemo(..., [])`. Island-local state uses `useSignal()`.
- **KV keys:** subscriptions `["push_subscriptions", householdId, id]` where `id` is the SHA-256 hex of the endpoint. Markers `["todo_notifications", householdId, todoId, firePointId]` where `firePointId` is `"due@<ISO instant>"`.
- **The claim always precedes the send.** Never send then claim.
- **`404`/`410` from the push service means delete that subscription.** In every send path.
- **Missing VAPID env must no-op with a log line**, never throw — otherwise every cron tick errors.
- **Never commit a private key.** Local dev keys live in the gitignored `.env`; production values are the maintainer's.
- **Never prompt for permission automatically.** Both entry points are user-tapped buttons; Safari requires a gesture and a denial is unrecoverable.
- **Copy stays English**, warm enough for a child; issue #13 converts the app in one pass.
- **Conventional Commits.** `deno task check` (`deno fmt --check && deno lint && deno check`) and `deno task test` (`deno test --unstable-kv -A`) must both pass before each commit.
- **Out of scope, do not build:** reminder offsets and their UI (4b), assignment-aware targeting (#17), offline asset caching, cleaning up the dead `pwa-sw.js` or the CDN `pwa-update` script, a due-index keyspace.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Modify `deno.json` | Add the `web-push` import (Task 1 decides whether). |
| Create `models/push-subscription/push-subscription.interface.ts` | `PushSubscriptionInterface` + DTOs. |
| Create `models/push-subscription/index.ts` | Barrel. |
| Modify `models/index.ts` | Register the barrel. |
| Create `utils/push-endpoint.ts` | The endpoint→id hash. Pure, one function. |
| Create `utils/push-endpoint.test.ts` | Hash stability and distinctness. |
| Create `database/push-subscription.repo.ts` | Subscription persistence, upsert by endpoint hash. |
| Create `database/push-subscription.repo.test.ts` | Upsert idempotency, isolation, delete. |
| Modify `database/index.ts` | Register the repo. |
| Create `database/todo-notification.repo.ts` | Marker claim + cascade delete. Its own repo because it is delivery bookkeeping, not a domain aggregate. |
| Create `database/todo-notification.repo.test.ts` | Claim-once, suppressed markers, cascade. |
| Modify `database/todo.repo.ts` | Cascade marker deletion from `delete`. |
| Modify `database/todo.repo.test.ts` | Assert the cascade. |
| Create `services/push-send.ts` | **The single send path.** Used by both the sweep and the test endpoint. Owns VAPID config and `404`/`410` cleanup. |
| Create `services/push-send.test.ts` | Stale cleanup, missing-env no-op. |
| Create `utils/todo-fire-points.ts` | Pure selection: which fire-points are due for sending, given `(todos, now)`. |
| Create `utils/todo-fire-points.test.ts` | The window, the cutoff, done/undated exclusion. |
| Create `services/notification-sweep.ts` | The sweep: select → claim → send. No `Deno.cron` here, so it stays testable. |
| Modify `main.ts` | Register `Deno.cron` pointing at the sweep. |
| Create `routes/api/push/vapid-key.ts` | `GET` the public key. |
| Create `routes/api/push/subscriptions.ts` | `POST` / `DELETE`. |
| Create `routes/api/push/subscriptions.test.ts` | Handler tests. |
| Create `routes/api/push/test.ts` | `POST` — send a test notification via the same path. |
| Create `static/push-sw.js` | `push` + `notificationclick`. Nothing else. |
| Create `islands/shell/usePushNotifications.ts` | Client: registration, permission, subscribe/unsubscribe, state. |
| Create `islands/shell/NotificationSetting.tsx` | The durable More-sheet control + test button. |
| Modify `islands/shell/MoreSheet.tsx` | Add the Notifications row. |
| Modify `islands/todos/TodoBacklog.tsx` | The contextual nudge; clear a notification on tick-off. |
| Modify `islands/todos/TodoBacklog.test.tsx` | Nudge visibility conditions. |
| Modify `docs/ui-ux-patterns.md` | Document the gesture-only permission pattern. |

Task order follows the dependency chain: spike → storage → send path → selection → sweep → API → client → UI.

---

### Task 1: SPIKE — can `web-push` send from Deno?

**Files:**
- Create (temporary): `scripts/spike-web-push.ts`
- Modify: `deno.json` (only if the spike succeeds)

**Interfaces:**
- Consumes: nothing.
- Produces: an answer, and — if positive — `web-push` available as an import.

**This task gates the whole plan.** `web-push` is a Node module that leans on Node's `crypto`. Its API is confirmed, but that it *runs* under Deno's Node compatibility is not. If it doesn't, the alternative is a Deno-native Web Push implementation or hand-rolling RFC 8291 encryption — materially different work, and vastly cheaper to discover now than after the subscription store, the service worker and the sweep all assume it.

**You cannot test against a real push service**, because that needs a real browser subscription and permission, which is unavailable here. But you don't need one: a `PushSubscription`'s `endpoint` is just a URL. Point it at a local HTTP server and assert `web-push` reaches it with a properly formed request. That exercises exactly the risky part — key generation, VAPID JWT signing, and payload encryption, all of which are the Node-crypto-dependent bits.

- [ ] **Step 1: Write the spike**

Create `scripts/spike-web-push.ts`:

```ts
/**
 * SPIKE (delete after Task 1): does npm:web-push run under Deno?
 *
 * We cannot reach a real push service without a browser subscription, but the
 * endpoint is just a URL — so we point it at a local server and assert web-push
 * generates keys, signs a VAPID JWT and encrypts a payload. Those are the
 * Node-crypto-dependent parts, which is the whole risk.
 */
import webpush from "npm:web-push@^3.6.7";

const received: { headers: Record<string, string>; bodyBytes: number }[] = [];

const server = Deno.serve({ port: 8787, onListen: () => {} }, async (req) => {
  const body = new Uint8Array(await req.arrayBuffer());
  received.push({
    headers: Object.fromEntries(req.headers),
    bodyBytes: body.byteLength,
  });
  return new Response(null, { status: 201 });
});

try {
  const keys = webpush.generateVAPIDKeys();
  console.log("1. generateVAPIDKeys OK");
  console.log("   publicKey length:", keys.publicKey.length);

  webpush.setVapidDetails("mailto:dev@example.com", keys.publicKey, keys.privateKey);
  console.log("2. setVapidDetails OK");

  // A syntactically valid subscription pointed at our local server. The p256dh
  // and auth values are a throwaway keypair generated the same way a browser
  // would, so the encryption step gets real inputs.
  const clientKeys = webpush.generateVAPIDKeys();
  await webpush.sendNotification(
    {
      endpoint: "http://localhost:8787/push",
      keys: {
        p256dh: clientKeys.publicKey,
        auth: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      },
    },
    JSON.stringify({ title: "Spike", body: "Due now" }),
  );
  console.log("3. sendNotification OK");
  console.log("   request reached local server:", received.length === 1);
  console.log("   has Authorization header:", !!received[0]?.headers["authorization"]);
  console.log("   encrypted body bytes:", received[0]?.bodyBytes);
  console.log("\nSPIKE RESULT: web-push WORKS under Deno");
} catch (err) {
  console.log("\nSPIKE RESULT: web-push FAILED under Deno");
  console.log(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  console.log(err instanceof Error ? err.stack : "");
} finally {
  await server.shutdown();
}
```

- [ ] **Step 2: Run it**

Run: `deno run --unstable-kv -A scripts/spike-web-push.ts`

Expected, if it works: all three OK lines, `request reached local server: true`, a non-zero `encrypted body bytes`, and `SPIKE RESULT: web-push WORKS under Deno`.

- [ ] **Step 3: Record the answer and act on it**

**If it worked:** add to `deno.json`'s `imports`:

```json
    "web-push": "npm:web-push@^3.6.7",
```

Then delete `scripts/spike-web-push.ts` — it was a probe, not a deliverable.

**If it failed:** do **not** improvise a replacement. Delete the spike, and report **BLOCKED** with the exact error, the failing step number, and the stack. The plan's remaining tasks assume a working send primitive and the choice of replacement is a design decision, not an implementation one.

- [ ] **Step 4: Verify and commit**

Run: `deno task check && deno task test`
Expected: both PASS, 324 passed (unchanged — nothing but a dependency was added).

```bash
git add deno.json
git commit -m "chore(push): add web-push after verifying it runs under Deno"
```

---

### Task 2: Subscription model, endpoint hash, and repo

**Files:**
- Create: `models/push-subscription/push-subscription.interface.ts`, `models/push-subscription/index.ts`
- Modify: `models/index.ts`
- Create: `utils/push-endpoint.ts`, `utils/push-endpoint.test.ts`
- Create: `database/push-subscription.repo.ts`, `database/push-subscription.repo.test.ts`
- Modify: `database/index.ts`

**Interfaces:**
- Consumes: `getKv` from `@/database/db.ts`.
- Produces:
  - `PushSubscriptionInterface`, `CreatePushSubscriptionDto`, `PushSubscriptionInput` from `@/models/index.ts`
  - `pushEndpointId(endpoint: string): Promise<string>` from `@/utils/push-endpoint.ts` — SHA-256 hex
  - `PushSubscriptionRepo` with `upsert(data: CreatePushSubscriptionDto): Promise<PushSubscriptionInterface>`, `getAll(householdId): Promise<PushSubscriptionInterface[]>`, `deleteByEndpoint(householdId, endpoint): Promise<boolean>`, `delete(householdId, id): Promise<void>`

**Why the id is a hash of the endpoint.** A device re-subscribing — permission re-granted, browser rotates the endpoint, site data cleared — must not create a second row, or one phone gets two notifications for the same to-do. Hashing makes `upsert` idempotent with no read-scan. A random UUID would need a scan-and-dedup on every subscribe.

`deleteByEndpoint` exists because the **client holds the endpoint, not the hash** — the unsubscribe route takes an endpoint in the body.

- [ ] **Step 1: Write the failing tests**

Create `utils/push-endpoint.test.ts`:

```ts
import { assertEquals, assertNotEquals } from "jsr:@std/assert@^1.0.19";
import { pushEndpointId } from "./push-endpoint.ts";

Deno.test("pushEndpointId — the same endpoint always yields the same id", async () => {
  const e = "https://fcm.googleapis.com/fcm/send/abc123";
  assertEquals(await pushEndpointId(e), await pushEndpointId(e));
});

Deno.test("pushEndpointId — different endpoints yield different ids", async () => {
  assertNotEquals(
    await pushEndpointId("https://fcm.googleapis.com/fcm/send/abc"),
    await pushEndpointId("https://fcm.googleapis.com/fcm/send/xyz"),
  );
});

Deno.test("pushEndpointId — is lowercase hex of a fixed length", async () => {
  const id = await pushEndpointId("https://example.com/push/1");
  assertEquals(id.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(id), true);
});
```

Create `database/push-subscription.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import type { CreatePushSubscriptionDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use, and no repo method runs until a test body does — so setting it here
// at module load is early enough. Each test uses a distinct householdId because
// the KV singleton is process-wide.
Deno.env.set("KV_PATH", ":memory:");

// sanitizeResources is disabled because getKv() opens a module-level KV
// singleton lazily and never closes it (by design, as in production).

function draft(
  householdId: string,
  endpoint: string,
  overrides: Partial<CreatePushSubscriptionDto> = {},
): CreatePushSubscriptionDto {
  return {
    householdId,
    userId: "user-1",
    endpoint,
    p256dh: "p256dh-value",
    auth: "auth-value",
    createdAt: "2026-08-05T10:00:00.000Z",
    ...overrides,
  };
}

Deno.test({
  name: "upsert — stores a subscription and derives the id from the endpoint",
  sanitizeResources: false,
  async fn() {
    const sub = await PushSubscriptionRepo.upsert(
      draft("hh-up", "https://push.example/one"),
    );

    assertEquals(sub.endpoint, "https://push.example/one");
    assertEquals(sub.id.length, 64);
    assertEquals((await PushSubscriptionRepo.getAll("hh-up")).length, 1);
  },
});

Deno.test({
  name: "upsert — re-subscribing the same endpoint does not duplicate",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-dupe";
    const first = await PushSubscriptionRepo.upsert(
      draft(hh, "https://push.example/same"),
    );
    const second = await PushSubscriptionRepo.upsert(
      draft(hh, "https://push.example/same", { auth: "rotated-auth" }),
    );

    assertEquals(first.id, second.id);
    const all = await PushSubscriptionRepo.getAll(hh);
    assertEquals(all.length, 1);
    assertEquals(all[0].auth, "rotated-auth");
  },
});

Deno.test({
  name: "getAll — households are isolated",
  sanitizeResources: false,
  async fn() {
    await PushSubscriptionRepo.upsert(draft("hh-mine", "https://push.example/m"));
    await PushSubscriptionRepo.upsert(draft("hh-theirs", "https://push.example/t"));

    const mine = await PushSubscriptionRepo.getAll("hh-mine");
    assertEquals(mine.map((s) => s.endpoint), ["https://push.example/m"]);
  },
});

Deno.test({
  name: "deleteByEndpoint — removes it and reports whether it existed",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-del";
    await PushSubscriptionRepo.upsert(draft(hh, "https://push.example/gone"));

    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint(hh, "https://push.example/gone"),
      true,
    );
    assertEquals(await PushSubscriptionRepo.getAll(hh), []);
    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint(hh, "https://push.example/gone"),
      false,
    );
  },
});

Deno.test({
  name: "deleteByEndpoint — cannot delete another household's subscription",
  sanitizeResources: false,
  async fn() {
    await PushSubscriptionRepo.upsert(draft("hh-a", "https://push.example/shared"));

    assertEquals(
      await PushSubscriptionRepo.deleteByEndpoint("hh-b", "https://push.example/shared"),
      false,
    );
    assertEquals((await PushSubscriptionRepo.getAll("hh-a")).length, 1);
  },
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A utils/push-endpoint.test.ts database/push-subscription.repo.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the model**

Create `models/push-subscription/push-subscription.interface.ts`:

```ts
export interface PushSubscriptionInterface {
  /**
   * SHA-256 hex of the endpoint URL. Derived rather than random so that a device
   * re-subscribing (permission re-granted, endpoint rotated, site data cleared)
   * upserts instead of creating a second row — otherwise one phone would get two
   * notifications for the same to-do.
   */
  id: string;
  householdId: string;
  /**
   * The user whose device this is. Stored but not yet used for targeting: today a
   * household has one user, and narrowing to a to-do's assignees needs the
   * member model from issue #17.
   */
  userId: string;
  /** The push service URL this device is reachable at. */
  endpoint: string;
  /** From the browser's PushSubscription — the ECDH public key. */
  p256dh: string;
  /** From the browser's PushSubscription — the auth secret. */
  auth: string;
  createdAt: string;
}

// Derived type for creation (no ID — the repo derives it from the endpoint).
export type CreatePushSubscriptionDto = Omit<PushSubscriptionInterface, "id">;

/**
 * What the client sends. The server fills in `id`, `householdId`, `userId` and
 * `createdAt` from the session — the client never sends (and cannot spoof) the
 * household.
 */
export type PushSubscriptionInput = Pick<
  PushSubscriptionInterface,
  "endpoint" | "p256dh" | "auth"
>;
```

Create `models/push-subscription/index.ts`:

```ts
export * from "./push-subscription.interface.ts";
```

Append to `models/index.ts`:

```ts
export * from "./push-subscription/index.ts";
```

- [ ] **Step 4: Write the hash helper**

Create `utils/push-endpoint.ts`:

```ts
/**
 * Derives a push subscription's stable id from its endpoint URL.
 *
 * Must stay byte-stable forever: changing how this is derived would orphan every
 * stored subscription and silently duplicate devices on their next subscribe.
 */
export async function pushEndpointId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 5: Write the repo**

Create `database/push-subscription.repo.ts`:

```ts
import type {
  CreatePushSubscriptionDto,
  PushSubscriptionInterface,
} from "@/models/index.ts";
import { pushEndpointId } from "@/utils/push-endpoint.ts";
import { getKv } from "./db.ts";

/**
 * Push subscriptions are stored per household so the delivery sweep — which
 * starts from a to-do, and therefore already knows the householdId — can find
 * every device to notify in one prefix scan with no joins
 * (`["push_subscriptions", householdId, id]`). The owning `userId` rides on the
 * record for when issue #17 makes assignee-targeting possible.
 *
 * Subscriptions deliberately outlive sessions (which expire after 24h), so this
 * is its own aggregate and never hangs off one.
 */
export class PushSubscriptionRepo {
  /** Idempotent by endpoint: re-subscribing the same device overwrites. */
  static async upsert(
    data: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionInterface> {
    const kv = await getKv();
    const id = await pushEndpointId(data.endpoint);
    const sub: PushSubscriptionInterface = { ...data, id };
    await kv.set(["push_subscriptions", data.householdId, id], sub);
    return sub;
  }

  static async getAll(
    householdId: string,
  ): Promise<PushSubscriptionInterface[]> {
    const kv = await getKv();
    const iter = kv.list<PushSubscriptionInterface>({
      prefix: ["push_subscriptions", householdId],
    });
    const subs: PushSubscriptionInterface[] = [];
    for await (const { value } of iter) subs.push(value);
    return subs;
  }

  /** The client holds the endpoint, not its hash, so unsubscribe goes through here. */
  static async deleteByEndpoint(
    householdId: string,
    endpoint: string,
  ): Promise<boolean> {
    const kv = await getKv();
    const id = await pushEndpointId(endpoint);
    const key = ["push_subscriptions", householdId, id];
    const existing = await kv.get<PushSubscriptionInterface>(key);
    if (existing.value === null) return false;
    await kv.delete(key);
    return true;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["push_subscriptions", householdId, id]);
  }
}
```

Append to `database/index.ts`:

```ts
export * from "./push-subscription.repo.ts";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `deno test --unstable-kv -A utils/push-endpoint.test.ts database/push-subscription.repo.test.ts`
Expected: PASS, 8 passed.

- [ ] **Step 7: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 332 passed (324 + 8).

- [ ] **Step 8: Commit**

```bash
git add models/push-subscription models/index.ts utils/push-endpoint.ts utils/push-endpoint.test.ts database/push-subscription.repo.ts database/push-subscription.repo.test.ts database/index.ts
git commit -m "feat(push): add push subscription model, endpoint hash and repo"
```

---

### Task 3: Marker repo and cascade from `TodoRepo.delete`

**Files:**
- Create: `database/todo-notification.repo.ts`, `database/todo-notification.repo.test.ts`
- Modify: `database/todo.repo.ts`, `database/todo.repo.test.ts`
- Modify: `database/index.ts`

**Interfaces:**
- Consumes: `getKv`.
- Produces: `TodoNotificationRepo` with
  - `claim(householdId, todoId, firePointId, opts: { sent: boolean }): Promise<boolean>` — `true` if this call won the claim, `false` if it was already claimed
  - `deleteForTodo(householdId, todoId): Promise<number>` — returns how many were removed

**The claim is the correctness heart of this feature.** `Deno.cron` retries a failed handler, and a partial failure mid-batch is exactly when it retries — so "have I sent this?" must be a **claim**, not read-then-write. One atomic does it:

```ts
kv.atomic().check({ key, versionstamp: null }).set(key, value).commit()
```

`check({ versionstamp: null })` succeeds only when the key does not exist, so a concurrent or repeated run loses and skips. This is why markers are a separate keyspace at all — see ADR 0005.

`sent: false` records a fire-point deliberately **suppressed** (past the one-hour cutoff) rather than delivered, so "why didn't I get a notification?" has an answer.

- [ ] **Step 1: Write the failing tests**

Create `database/todo-notification.repo.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name: "claim — the first call wins and the second loses",
  sanitizeResources: false,
  async fn() {
    const fp = "due@2026-08-06T07:00:00.000Z";
    assertEquals(
      await TodoNotificationRepo.claim("hh-c", "todo-1", fp, { sent: true }),
      true,
    );
    assertEquals(
      await TodoNotificationRepo.claim("hh-c", "todo-1", fp, { sent: true }),
      false,
    );
  },
});

Deno.test({
  name: "claim — a different fire-point on the same to-do is claimable",
  sanitizeResources: false,
  async fn() {
    const todo = "todo-2";
    await TodoNotificationRepo.claim("hh-fp", todo, "due@2026-08-06T07:00:00.000Z", {
      sent: true,
    });
    assertEquals(
      await TodoNotificationRepo.claim("hh-fp", todo, "due@2026-08-20T07:00:00.000Z", {
        sent: true,
      }),
      true,
    );
  },
});

Deno.test({
  name: "claim — households are isolated",
  sanitizeResources: false,
  async fn() {
    const fp = "due@2026-08-06T07:00:00.000Z";
    await TodoNotificationRepo.claim("hh-x", "todo-3", fp, { sent: true });
    assertEquals(
      await TodoNotificationRepo.claim("hh-y", "todo-3", fp, { sent: true }),
      true,
    );
  },
});

Deno.test({
  name: "claim — records whether it was sent or suppressed",
  sanitizeResources: false,
  async fn() {
    const kv = await (await import("@/database/db.ts")).getKv();
    const fp = "due@2026-07-01T07:00:00.000Z";
    await TodoNotificationRepo.claim("hh-sup", "todo-4", fp, { sent: false });

    const stored = await kv.get<{ sent: boolean; claimedAt: string }>([
      "todo_notifications",
      "hh-sup",
      "todo-4",
      fp,
    ]);
    assertEquals(stored.value?.sent, false);
    assertEquals(typeof stored.value?.claimedAt, "string");
  },
});

Deno.test({
  name: "deleteForTodo — removes every marker for that to-do and no others",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-cascade";
    await TodoNotificationRepo.claim(hh, "todo-a", "due@2026-08-06T07:00:00.000Z", {
      sent: true,
    });
    await TodoNotificationRepo.claim(hh, "todo-a", "due@2026-08-20T07:00:00.000Z", {
      sent: true,
    });
    await TodoNotificationRepo.claim(hh, "todo-b", "due@2026-08-06T07:00:00.000Z", {
      sent: true,
    });

    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-a"), 2);
    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-a"), 0);
    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-b"), 1);
  },
});
```

Append to `database/todo.repo.test.ts`:

```ts
Deno.test({
  name: "delete — also removes the to-do's notification markers",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-todo-cascade";
    const todo = await TodoRepo.create(draft(hh, "Book the venue"));
    await TodoNotificationRepo.claim(hh, todo.id, "due@2026-08-06T07:00:00.000Z", {
      sent: true,
    });

    await TodoRepo.delete(hh, todo.id);

    // Claimable again only because the marker is gone.
    assertEquals(
      await TodoNotificationRepo.claim(hh, todo.id, "due@2026-08-06T07:00:00.000Z", {
        sent: true,
      }),
      true,
    );
  },
});
```

Add its import to the top of that file:

```ts
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A database/todo-notification.repo.test.ts database/todo.repo.test.ts`
Expected: FAIL — `todo-notification.repo.ts` not found.

- [ ] **Step 3: Write the marker repo**

Create `database/todo-notification.repo.ts`:

```ts
import { getKv } from "./db.ts";

export interface TodoNotificationMarker {
  claimedAt: string;
  /** false = deliberately suppressed (past the staleness cutoff), not delivered. */
  sent: boolean;
}

/**
 * Delivery bookkeeping for to-do notifications — deliberately NOT a field on the
 * to-do. `Deno.cron` retries a failed handler, so "have I already sent this?"
 * must be an atomic **claim** rather than read-then-write; a flag on the to-do
 * would need compare-and-swap on the whole record and would race member edits
 * through an already non-atomic `TodoRepo.update`. See docs/adr/0005.
 *
 * Keys are `["todo_notifications", householdId, todoId, firePointId]`, where
 * firePointId is `due@<ISO instant>`. The instant is part of the id so that
 * rescheduling a to-do mints a new fire-point and notifies again, while a repeat
 * run against the same instant still sends once.
 */
export class TodoNotificationRepo {
  /** Returns true only if this call won the claim. */
  static async claim(
    householdId: string,
    todoId: string,
    firePointId: string,
    opts: { sent: boolean },
  ): Promise<boolean> {
    const kv = await getKv();
    const key = ["todo_notifications", householdId, todoId, firePointId];
    const marker: TodoNotificationMarker = {
      claimedAt: new Date().toISOString(),
      sent: opts.sent,
    };
    // check({ versionstamp: null }) commits only if the key does not exist, so a
    // concurrent run or a cron retry loses and skips.
    const res = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, marker)
      .commit();
    return res.ok;
  }

  /** Cascade for TodoRepo.delete — markers must not outlive their to-do. */
  static async deleteForTodo(
    householdId: string,
    todoId: string,
  ): Promise<number> {
    const kv = await getKv();
    const iter = kv.list({
      prefix: ["todo_notifications", householdId, todoId],
    });
    const keys: Deno.KvKey[] = [];
    for await (const { key } of iter) keys.push(key);
    if (keys.length === 0) return 0;

    let atomic = kv.atomic();
    for (const key of keys) atomic = atomic.delete(key);
    const res = await atomic.commit();
    if (!res.ok) throw new Error("Failed to delete notification markers.");
    return keys.length;
  }
}
```

Append to `database/index.ts`:

```ts
export * from "./todo-notification.repo.ts";
```

- [ ] **Step 4: Cascade from `TodoRepo.delete`**

In `database/todo.repo.ts`, add the import:

```ts
import { TodoNotificationRepo } from "./todo-notification.repo.ts";
```

And change `delete`:

```ts
  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    // Markers must not outlive their to-do: ids are never reused, so orphans
    // could never be reclaimed and would accumulate forever.
    await TodoNotificationRepo.deleteForTodo(householdId, id);
    await kv.delete(["todos", householdId, id]);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --unstable-kv -A database/todo-notification.repo.test.ts database/todo.repo.test.ts`
Expected: PASS — 5 new marker tests plus 1 new repo test, and every pre-existing `todo.repo` test still passing **untouched**. If an existing one needs changing, the cascade has broken something — stop and report it.

- [ ] **Step 6: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 338 passed (332 + 6).

- [ ] **Step 7: Commit**

```bash
git add database/todo-notification.repo.ts database/todo-notification.repo.test.ts database/todo.repo.ts database/todo.repo.test.ts database/index.ts
git commit -m "feat(push): add claim-based notification markers with cascade delete"
```

---

### Task 4: The single send path

**Files:**
- Create: `services/push-send.ts`, `services/push-send.test.ts`

**Interfaces:**
- Consumes: `web-push` (Task 1), `PushSubscriptionRepo` (Task 2).
- Produces:
  - `interface PushPayload { title: string; body: string; tag: string; url: string }`
  - `sendToHousehold(householdId: string, payload: PushPayload, subs?: PushSubscriptionInterface[]): Promise<{ sent: number; failed: number }>`
  - `isPushConfigured(): boolean`

**This is the only place that talks to `web-push`.** Both the sweep and the test endpoint go through it, differing only in payload — a separate "test" path would verify code nobody uses in anger, which is worse than no test because it produces false confidence.

Two behaviours it owns:

**Missing VAPID env must no-op**, not throw. Otherwise every five-minute cron tick throws in production before the feature is even configured.

**`404` or `410` means the subscription is dead — delete it.** Without this, a household that clears site data accumulates dead endpoints and every run wastes requests on them forever.

The optional `subs` parameter lets the sweep read a household's subscriptions **once per run** and pass them in, rather than re-reading for each of several to-dos due at the same 09:00 default.

- [ ] **Step 1: Write the failing tests**

Create `services/push-send.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import webpush from "web-push";
import { isPushConfigured, sendToHousehold } from "./push-send.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";

Deno.env.set("KV_PATH", ":memory:");

const VAPID = {
  VAPID_PUBLIC_KEY: "test-public",
  VAPID_PRIVATE_KEY: "test-private",
  VAPID_SUBJECT: "mailto:dev@example.com",
};
function withVapid() {
  for (const [k, v] of Object.entries(VAPID)) Deno.env.set(k, v);
}
function withoutVapid() {
  for (const k of Object.keys(VAPID)) Deno.env.delete(k);
}

const payload = {
  title: "Book the venue",
  body: "Due now",
  tag: "todo-1",
  url: "/todos",
};

async function seedSub(householdId: string, endpoint: string) {
  await PushSubscriptionRepo.upsert({
    householdId,
    userId: "u1",
    endpoint,
    p256dh: "p",
    auth: "a",
    createdAt: "2026-08-05T10:00:00.000Z",
  });
}

Deno.test({
  name: "isPushConfigured — false without env, true with it",
  sanitizeResources: false,
  fn() {
    withoutVapid();
    assertEquals(isPushConfigured(), false);
    withVapid();
    assertEquals(isPushConfigured(), true);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — no-ops without VAPID env rather than throwing",
  sanitizeResources: false,
  async fn() {
    withoutVapid();
    await seedSub("hh-noenv", "https://push.example/a");

    const res = await sendToHousehold("hh-noenv", payload);

    assertEquals(res, { sent: 0, failed: 0 });
  },
});

Deno.test({
  name: "sendToHousehold — sends to every subscription in the household",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-send";
    await seedSub(hh, "https://push.example/one");
    await seedSub(hh, "https://push.example/two");
    using _s = stub(
      webpush,
      "sendNotification",
      () => Promise.resolve({ statusCode: 201 } as never),
    );

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 2, failed: 0 });
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — a 410 deletes that subscription",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-gone";
    await seedSub(hh, "https://push.example/dead");
    using _s = stub(webpush, "sendNotification", () => {
      const err = new Error("gone") as Error & { statusCode: number };
      err.statusCode = 410;
      return Promise.reject(err);
    });

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 0, failed: 1 });
    assertEquals(await PushSubscriptionRepo.getAll(hh), []);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — a 500 counts as failed but keeps the subscription",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-transient";
    await seedSub(hh, "https://push.example/flaky");
    using _s = stub(webpush, "sendNotification", () => {
      const err = new Error("server error") as Error & { statusCode: number };
      err.statusCode = 500;
      return Promise.reject(err);
    });

    const res = await sendToHousehold(hh, payload);

    assertEquals(res, { sent: 0, failed: 1 });
    assertEquals((await PushSubscriptionRepo.getAll(hh)).length, 1);
    withoutVapid();
  },
});

Deno.test({
  name: "sendToHousehold — uses supplied subscriptions instead of re-reading",
  sanitizeResources: false,
  async fn() {
    withVapid();
    const hh = "hh-supplied";
    await seedSub(hh, "https://push.example/stored");
    using _s = stub(
      webpush,
      "sendNotification",
      () => Promise.resolve({ statusCode: 201 } as never),
    );

    const res = await sendToHousehold(hh, payload, []);

    assertEquals(res, { sent: 0, failed: 0 });
    withoutVapid();
  },
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A services/push-send.test.ts`
Expected: FAIL — `./push-send.ts` not found.

- [ ] **Step 3: Write the send path**

Create `services/push-send.ts`:

```ts
import webpush from "web-push";
import type { PushSubscriptionInterface } from "@/models/index.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";

export interface PushPayload {
  title: string;
  body: string;
  /** Per-to-do (`todo-<id>`) so notifications stay separate but a re-send replaces. */
  tag: string;
  /** Where notificationclick should take the member. */
  url: string;
}

/**
 * The single path to the push service. Both the cron sweep and the
 * test-notification endpoint go through here, differing only in payload — a
 * separate test path would exercise code nobody uses in anger and produce false
 * confidence.
 */

function vapid() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

/**
 * Sends one notification to every device in a household.
 *
 * `subs` lets the sweep read a household's subscriptions once per run and pass
 * them in, rather than re-reading for each of several to-dos sharing an instant
 * (which the 09:00 create-sheet default makes the common case).
 */
export async function sendToHousehold(
  householdId: string,
  payload: PushPayload,
  subs?: PushSubscriptionInterface[],
): Promise<{ sent: number; failed: number }> {
  const config = vapid();
  if (!config) {
    // Deliberately not an error: without this the cron tick would throw every
    // five minutes on a deployment where push simply isn't configured yet.
    console.warn("[push] VAPID env not set — skipping send");
    return { sent: 0, failed: 0 };
  }
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const targets = subs ?? await PushSubscriptionRepo.getAll(householdId);
  let sent = 0;
  let failed = 0;

  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The push service says this endpoint is dead. Left in place, every run
        // would keep paying for it forever.
        await PushSubscriptionRepo.delete(householdId, sub.id);
        console.info(`[push] removed dead subscription ${sub.id}`);
      } else {
        console.error(`[push] send failed (${status ?? "no status"})`, err);
      }
    }
  }

  return { sent, failed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A services/push-send.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 5: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 344 passed (338 + 6).

- [ ] **Step 6: Commit**

```bash
git add services/push-send.ts services/push-send.test.ts
git commit -m "feat(push): add the single send path with stale-subscription cleanup"
```

---

### Task 5: Fire-point selection, and the sweep

**Files:**
- Create: `utils/todo-fire-points.ts`, `utils/todo-fire-points.test.ts`
- Create: `services/notification-sweep.ts`
- Modify: `main.ts`

**Interfaces:**
- Consumes: `TodoInterface`; `TodoRepo` (for the scan); `TodoNotificationRepo.claim` (Task 3); `sendToHousehold` (Task 4).
- Produces:
  - `interface DueFirePoint { todo: TodoInterface; firePointId: string; withinWindow: boolean }`
  - `selectDueFirePoints(todos: TodoInterface[], now: Date): DueFirePoint[]` from `@/utils/todo-fire-points.ts` — pure
  - `sweepDueNotifications(): Promise<{ claimed: number; sent: number; suppressed: number }>` from `@/services/notification-sweep.ts`

**Selection is pure and separate from the sweep** for the same reason `utils/todo-due.ts` is: the boundary rules are the part that can be wrong, and pure functions are testable without KV, cron or a browser.

Rules, all comparing instants (no timezone reasoning — cron runs in UTC and `dueAt` is an instant, per ADR 0004):

- Only **open** to-dos (`completedAt === null`) with a non-null `dueAt`.
- The fire-point is `dueAt`; its id is `due@<dueAt>`.
- `withinWindow` is true when `now - 1 hour <= dueAt <= now`.
- Anything older than an hour is still returned, with `withinWindow: false`, so the sweep can **claim it without sending**. That records it as handled and stops it firing spuriously later; the to-do still reads as **Overdue** in the app.
- A `dueAt` in the future is not returned at all.

- [ ] **Step 1: Write the failing tests**

Create `utils/todo-fire-points.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { selectDueFirePoints } from "./todo-fire-points.ts";
import type { TodoInterface } from "@/models/index.ts";

const now = new Date("2026-08-06T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60_000).toISOString();
const minutesAhead = (m: number) =>
  new Date(now.getTime() + m * 60_000).toISOString();

function todo(over: Partial<TodoInterface>): TodoInterface {
  return {
    id: "t1",
    householdId: "hh",
    title: "Book the venue",
    createdBy: "u1",
    createdAt: "2026-08-01T10:00:00.000Z",
    completedAt: null,
    dueAt: null,
    ...over,
  };
}

Deno.test("selectDueFirePoints — a moment just passed is in the window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(3) })], now);
  assertEquals(res.length, 1);
  assertEquals(res[0].withinWindow, true);
  assertEquals(res[0].firePointId, `due@${minutesAgo(3)}`);
});

Deno.test("selectDueFirePoints — a future moment is not selected at all", () => {
  assertEquals(selectDueFirePoints([todo({ dueAt: minutesAhead(30) })], now), []);
});

Deno.test("selectDueFirePoints — older than an hour is selected but out of window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(90) })], now);
  assertEquals(res.length, 1);
  assertEquals(res[0].withinWindow, false);
});

Deno.test("selectDueFirePoints — exactly one hour ago is still in the window", () => {
  const res = selectDueFirePoints([todo({ dueAt: minutesAgo(60) })], now);
  assertEquals(res[0].withinWindow, true);
});

Deno.test("selectDueFirePoints — done to-dos are ignored", () => {
  assertEquals(
    selectDueFirePoints(
      [todo({ dueAt: minutesAgo(5), completedAt: minutesAgo(2) })],
      now,
    ),
    [],
  );
});

Deno.test("selectDueFirePoints — undated to-dos are ignored", () => {
  assertEquals(selectDueFirePoints([todo({ dueAt: null })], now), []);
});

Deno.test("selectDueFirePoints — the fire-point id carries the instant", () => {
  const due = minutesAgo(10);
  const res = selectDueFirePoints([todo({ dueAt: due })], now);
  // Rescheduling must mint a new fire-point, so the instant is part of the id.
  assertEquals(res[0].firePointId, `due@${due}`);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A utils/todo-fire-points.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the selection**

Create `utils/todo-fire-points.ts`:

```ts
import type { TodoInterface } from "@/models/index.ts";

/**
 * Which fire-points are ready for the delivery sweep to act on.
 *
 * Pure and free of KV, cron and DOM for the same reason `utils/todo-due.ts` is:
 * the boundary rules are the part that can be wrong, so they need to be testable
 * on their own. Everything here compares instants — cron runs in UTC and `dueAt`
 * is an instant, so no timezone reasoning is involved (docs/adr/0004).
 */

/** How late a moment may be and still be worth sending. */
export const SEND_WINDOW_MS = 60 * 60 * 1000;

export interface DueFirePoint {
  todo: TodoInterface;
  /** `due@<ISO instant>` — the instant is part of the id so a reschedule re-fires. */
  firePointId: string;
  /**
   * false means the moment passed more than an hour ago: claim it, don't send it.
   * A notification about something due last Tuesday arriving now is noise, and
   * the to-do already reads as Overdue in the app.
   */
  withinWindow: boolean;
}

export function selectDueFirePoints(
  todos: TodoInterface[],
  now: Date,
): DueFirePoint[] {
  const nowMs = now.getTime();
  const out: DueFirePoint[] = [];

  for (const todo of todos) {
    if (todo.completedAt !== null) continue;
    if (todo.dueAt === null) continue;

    const dueMs = new Date(todo.dueAt).getTime();
    if (dueMs > nowMs) continue;

    out.push({
      todo,
      firePointId: `due@${todo.dueAt}`,
      withinWindow: nowMs - dueMs <= SEND_WINDOW_MS,
    });
  }

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --unstable-kv -A utils/todo-fire-points.test.ts`
Expected: PASS, 7 passed.

- [ ] **Step 5: Write the sweep**

Create `services/notification-sweep.ts`:

```ts
import { getKv } from "@/database/db.ts";
import type { TodoInterface } from "@/models/index.ts";
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import { isPushConfigured, sendToHousehold } from "./push-send.ts";
import { selectDueFirePoints } from "@/utils/todo-fire-points.ts";

/**
 * One pass of the due-notification sweep.
 *
 * Deliberately separate from the `Deno.cron` registration in main.ts so it can be
 * called directly. Delivery is a sweep rather than a scheduled job because KV
 * queues are unsupported on the new Deno Deploy — and because nothing needs
 * cancelling when a to-do is edited, ticked off or deleted (docs/adr/0005).
 *
 * Claim always precedes send: cron retries a failed handler, so a claim-after-send
 * could double-notify and a send-without-claim could lose one.
 */
export async function sweepDueNotifications(): Promise<
  { claimed: number; sent: number; suppressed: number }
> {
  if (!isPushConfigured()) {
    console.warn("[sweep] VAPID env not set — skipping");
    return { claimed: 0, sent: 0, suppressed: 0 };
  }

  const kv = await getKv();
  const todos: TodoInterface[] = [];
  for await (const { value } of kv.list<TodoInterface>({ prefix: ["todos"] })) {
    todos.push(value);
  }

  const due = selectDueFirePoints(todos, new Date());
  let claimed = 0;
  let sent = 0;
  let suppressed = 0;

  // Read each household's devices once per run: several to-dos sharing the 09:00
  // default is the common case, so re-reading per to-do is pure waste.
  const subsByHousehold = new Map<
    string,
    Awaited<ReturnType<typeof PushSubscriptionRepo.getAll>>
  >();

  for (const { todo, firePointId, withinWindow } of due) {
    const won = await TodoNotificationRepo.claim(
      todo.householdId,
      todo.id,
      firePointId,
      { sent: withinWindow },
    );
    if (!won) continue;
    claimed++;

    if (!withinWindow) {
      suppressed++;
      continue;
    }

    if (!subsByHousehold.has(todo.householdId)) {
      subsByHousehold.set(
        todo.householdId,
        await PushSubscriptionRepo.getAll(todo.householdId),
      );
    }

    const result = await sendToHousehold(
      todo.householdId,
      {
        title: todo.title,
        body: "Due now",
        tag: `todo-${todo.id}`,
        url: "/todos",
      },
      subsByHousehold.get(todo.householdId),
    );
    sent += result.sent;
  }

  if (claimed > 0) {
    console.info(
      `[sweep] claimed=${claimed} sent=${sent} suppressed=${suppressed}`,
    );
  }
  return { claimed, sent, suppressed };
}
```

- [ ] **Step 6: Register the cron**

In `main.ts`, add above `export const app`:

```ts
import { sweepDueNotifications } from "@/services/notification-sweep.ts";

// Deno Deploy extracts Deno.cron definitions at deploy time, so this must be at
// module scope in the entry point. Cron runs in UTC, which needs no special
// handling: the sweep compares instants.
//
// The retries are what make the atomic marker claim load-bearing rather than
// theoretical — a handler that fails part-way through a batch is re-run over the
// same fire-points.
Deno.cron(
  "todo-due-notifications",
  "*/5 * * * *",
  { backoffSchedule: [1000, 5000, 10000] },
  async () => {
    await sweepDueNotifications();
  },
);
```

- [ ] **Step 7: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 351 passed (344 + 7).

Note: `Deno.cron` requires `--unstable-cron` on some Deno versions. If `deno task check` or the dev server reports that, **stop and report it** — adding an unstable flag changes `deno.json`'s task definitions, which affects every command in this repo and is worth deciding deliberately rather than in passing.

- [ ] **Step 8: Commit**

```bash
git add utils/todo-fire-points.ts utils/todo-fire-points.test.ts services/notification-sweep.ts main.ts
git commit -m "feat(push): add fire-point selection and the cron delivery sweep"
```

---

### Task 6: API routes

**Files:**
- Create: `routes/api/push/vapid-key.ts`, `routes/api/push/subscriptions.ts`, `routes/api/push/test.ts`
- Create: `routes/api/push/subscriptions.test.ts`

**Interfaces:**
- Consumes: `PushSubscriptionRepo`, `sendToHousehold`, `isPushConfigured`, the shared HTTP helpers.
- Produces the wire contract the client uses:
  - `GET /api/push/vapid-key` → `200 { publicKey }`, or `503` when unconfigured
  - `POST /api/push/subscriptions`, body `PushSubscriptionInput` → `201` the stored subscription, `400` on a malformed body
  - `DELETE /api/push/subscriptions`, body `{ endpoint }` → `204`, `404` if unknown
  - `POST /api/push/test` → `200 { sent, failed }`

The VAPID **public** key is public by definition. It needs an endpoint rather than SSR props because the notifications control lives in the app shell, where there is no route loader to inject through.

`DELETE` takes the endpoint in the body because the client holds the endpoint, not its hash.

- [ ] **Step 1: Write the failing tests**

Create `routes/api/push/subscriptions.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { type Context } from "fresh";
import { handler } from "@/routes/api/push/subscriptions.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

interface State {
  userId?: string;
  householdId?: string;
}

function ctx(req: Request, state: State = {}): Context<State> {
  return { req, state } as unknown as Context<State>;
}

async function clearSubs() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["push_subscriptions"] })) {
    await kv.delete(e.key);
  }
}

const AUTH: State = { userId: "u1", householdId: "h1" };
const valid = {
  endpoint: "https://push.example/abc",
  p256dh: "p256dh-value",
  auth: "auth-value",
};

const post = (body: unknown) =>
  new Request("http://x/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const del = (body: unknown) =>
  new Request("http://x/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test({
  name: "POST stores a subscription (201) with server-derived fields",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    const res = await handler.POST(ctx(post(valid), AUTH));
    assertEquals(res.status, 201);
    const stored = await res.json();

    assertEquals(stored.householdId, "h1");
    assertEquals(stored.userId, "u1");
    assertEquals(stored.endpoint, valid.endpoint);
    assertEquals(stored.id.length, 64);
  },
});

Deno.test({
  name: "POST twice for the same endpoint does not duplicate",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));
    await handler.POST(ctx(post(valid), AUTH));

    assertEquals((await PushSubscriptionRepo.getAll("h1")).length, 1);
  },
});

Deno.test({
  name: "POST rejects a malformed body (400)",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    for (const bad of [
      {},
      { endpoint: "https://x/y" },
      { endpoint: "https://x/y", p256dh: "p" },
      { endpoint: 7, p256dh: "p", auth: "a" },
    ]) {
      assertEquals((await handler.POST(ctx(post(bad), AUTH))).status, 400);
    }
  },
});

Deno.test({
  name: "DELETE removes it (204); an unknown endpoint is 404",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));

    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), AUTH))).status,
      204,
    );
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), AUTH))).status,
      404,
    );
  },
});

Deno.test({
  name: "another household cannot delete your subscription",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    await handler.POST(ctx(post(valid), AUTH));

    const theirs: State = { userId: "u2", householdId: "h2" };
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint }), theirs))).status,
      404,
    );
    assertEquals((await PushSubscriptionRepo.getAll("h1")).length, 1);
  },
});

Deno.test({
  name: "POST and DELETE require a household (401)",
  sanitizeResources: false,
  async fn() {
    await clearSubs();
    assertEquals((await handler.POST(ctx(post(valid)))).status, 401);
    assertEquals(
      (await handler.DELETE(ctx(del({ endpoint: valid.endpoint })))).status,
      401,
    );
  },
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A routes/api/push/subscriptions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the subscriptions route**

Create `routes/api/push/subscriptions.ts`:

```ts
import { badRequest, define, json, noContent, notFound } from "@/utils/index.ts";
import { PushSubscriptionRepo } from "@/database/index.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await ctx.req.json();
    for (const field of ["endpoint", "p256dh", "auth"] as const) {
      if (typeof body[field] !== "string" || !body[field]) {
        return badRequest(`${field} required`);
      }
    }

    const sub = await PushSubscriptionRepo.upsert({
      householdId,
      userId,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      createdAt: new Date().toISOString(),
    });
    return json(sub, 201);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const body = await ctx.req.json();
    if (typeof body.endpoint !== "string" || !body.endpoint) {
      return badRequest("endpoint required");
    }

    const removed = await PushSubscriptionRepo.deleteByEndpoint(
      householdId,
      body.endpoint,
    );
    if (!removed) return notFound("no such subscription");
    return noContent();
  },
});
```

- [ ] **Step 4: Write the VAPID key and test routes**

Create `routes/api/push/vapid-key.ts`:

```ts
import { define, json } from "@/utils/index.ts";

export const handler = define.handlers({
  GET(ctx) {
    if (!ctx.state.householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    // The public key is public by definition — it ships to the browser as
    // applicationServerKey. Only its absence is interesting.
    if (!publicKey) {
      return new Response("Push not configured", { status: 503 });
    }
    return json({ publicKey });
  },
});
```

Create `routes/api/push/test.ts`:

```ts
import { define, json } from "@/utils/index.ts";
import { sendToHousehold } from "@/services/push-send.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    // Deliberately the same sendToHousehold the sweep uses, differing only in
    // payload. A separate test path would verify code nobody uses in anger.
    const result = await sendToHousehold(householdId, {
      title: "Happie is set up",
      body: "Notifications are working.",
      tag: "push-test",
      url: "/todos",
    });
    return json(result);
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --unstable-kv -A routes/api/push/subscriptions.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 6: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 357 passed (351 + 6).

- [ ] **Step 7: Commit**

```bash
git add routes/api/push
git commit -m "feat(push): add subscription, VAPID key and test-send endpoints"
```

---

### Task 7: The service worker and the client hook

**Files:**
- Create: `static/push-sw.js`
- Create: `islands/shell/usePushNotifications.ts`

**Interfaces:**
- Consumes: the Task 6 endpoints.
- Produces: `usePushNotifications()` returning
  - `state: Signal<"unsupported" | "needs-install" | "default" | "denied" | "granted">`
  - `busy: Signal<boolean>`
  - `enable(): Promise<boolean>` — request permission, subscribe, POST. Must be called **from a user gesture**.
  - `disable(): Promise<boolean>` — unsubscribe and DELETE
  - `sendTest(): Promise<{ sent: number; failed: number } | null>`
  - `syncIfGranted(): Promise<void>` — if permission is already granted but nothing is stored, subscribe silently

**The service worker is push-only by design.** Verified before deciding: nothing is registered today (`getRegistrations()` returns `[]`) and `static/pwa-sw.js` is dead code, so scope `/` is free. Reusing that Workbox file would switch on app-wide asset caching for the first time as a side effect of shipping notifications — stale islands after a deploy, affecting every page. That deserves its own iteration.

**`needs-install`** exists because on iOS `pushManager.subscribe()` only works in a PWA installed to the home screen (16.4+); in a plain Safari tab it fails. Detect it via `navigator.standalone === false` on iOS and say *add Happie to your home screen first*, rather than surfacing an error nobody can act on.

- [ ] **Step 1: Write the service worker**

Create `static/push-sw.js`:

```js
// Push-only service worker. Deliberately no caching: registering the Workbox
// worker in static/pwa-sw.js would switch on app-wide asset caching for the first
// time as a side effect of shipping notifications, which is a change to every
// page and deserves its own iteration.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Happie", body: event.data.text(), tag: "happie" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Happie", {
      body: payload.body ?? "",
      // Per-to-do tag: keeps separate to-dos separate (so each is individually
      // actionable) while a re-send for the same to-do replaces rather than
      // stacking. A shared tag would collapse them all into one.
      tag: payload.tag ?? "happie",
      data: { url: payload.url ?? "/todos" },
      icon: "/web-app-manifest-192x192.png",
      badge: "/favicon-96x96.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/todos";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
```

- [ ] **Step 2: Write the client hook**

Create `islands/shell/usePushNotifications.ts`:

```ts
import { signal } from "@preact/signals";

export type PushState =
  | "unsupported"
  | "needs-install"
  | "default"
  | "denied"
  | "granted";

const SW_PATH = "/push-sw.js";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** iOS only allows push in an installed PWA (16.4+). */
function iosNeedsInstall(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    matchMedia("(display-mode: standalone)").matches;
  return !standalone;
}

/**
 * Client side of push notifications.
 *
 * `enable()` MUST be called from a user gesture: Safari requires it for
 * `Notification.requestPermission()`, and a denial is near-unrecoverable (it takes
 * digging through browser site settings), so we only ever ask on an explicit tap.
 */
export function usePushNotifications() {
  const state = signal<PushState>("default");
  const busy = signal(false);

  const detect = (): PushState => {
    if (!("serviceWorker" in navigator) || !("PushManager" in globalThis)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") return "granted";
    if (iosNeedsInstall()) return "needs-install";
    return "default";
  };

  // `navigator` does not exist during SSR, so detect() must not run there — it
  // would throw and take the whole page down. Server-rendering as "default" also
  // keeps SSR output deterministic and testable; hydration immediately replaces
  // it with the device's real state.
  state.value = typeof navigator === "undefined" ? "default" : detect();

  const register = () =>
    navigator.serviceWorker.register(SW_PATH, { scope: "/" });

  const postSubscription = async (sub: PushSubscription): Promise<boolean> => {
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
    return res.ok;
  };

  const subscribe = async (): Promise<boolean> => {
    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();

    const reg = await register();
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    return await postSubscription(sub);
  };

  const enable = async (): Promise<boolean> => {
    busy.value = true;
    try {
      // Called synchronously inside the tap handler — see the note above.
      const permission = await Notification.requestPermission();
      state.value = detect();
      if (permission !== "granted") return false;
      return await subscribe();
    } catch (err) {
      console.error("[push] enable failed", err);
      return false;
    } finally {
      busy.value = false;
    }
  };

  const disable = async (): Promise<boolean> => {
    busy.value = true;
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return true;
      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      return true;
    } finally {
      busy.value = false;
    }
  };

  /** Permission already granted but nothing stored — after clearing site data. */
  const syncIfGranted = async (): Promise<void> => {
    if (detect() !== "granted") return;
    await subscribe();
  };

  const sendTest = async () => {
    busy.value = true;
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) return null;
      return await res.json() as { sent: number; failed: number };
    } finally {
      busy.value = false;
    }
  };

  return { state, busy, enable, disable, sendTest, syncIfGranted };
}
```

- [ ] **Step 3: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 357 passed (unchanged — no tests added).

There is deliberately **no unit test here**: the hook's behaviour is entirely browser API calls (`Notification.requestPermission`, `pushManager.subscribe`), and this repo has no DOM harness. Stubbing those would test the stubs. The service worker likewise cannot be exercised without a real push. This is the unverifiable surface the spec calls out, and it is why Task 8's test button matters.

- [ ] **Step 4: Commit**

```bash
git add static/push-sw.js islands/shell/usePushNotifications.ts
git commit -m "feat(push): add the push-only service worker and client hook"
```

---

### Task 8: The notifications control and the nudge

**Files:**
- Create: `islands/shell/NotificationSetting.tsx`
- Modify: `islands/shell/MoreSheet.tsx`
- Modify: `islands/todos/TodoBacklog.tsx`, `islands/todos/TodoBacklog.test.tsx`
- Modify: `docs/ui-ux-patterns.md`

**Interfaces:**
- Consumes: `usePushNotifications` (Task 7); `Sheet`, `Button`, `ListItem`, `Icon`, `Pressable`, `Snackbar` from the MD3 library; `setDueAt`/`openTodos` already in the island.
- Produces: `NotificationSetting` (default export), consumed by `MoreSheet`.

Two entry points, both **buttons a member taps**:

**The durable control** — a Notifications row in the More sheet beside Shopping and Loyalty cards. This is what makes the nudge safely dismissible; a nudge you can dismiss and never recover is a trap. It also carries the **"Send a test notification"** button, which is the only way the maintainer can confirm the pipeline on their own phone in one tap rather than waiting for a cron tick and guessing which half failed.

**The contextual nudge** on `/todos`, shown only when the household has at least one **dated** to-do and `state === "default"`. That is the one moment the intent is unambiguous. Dismissible for the session.

Copy the tests assert on, keep exact: `"Notifications"`, `"Turn on reminders"`, `"Send a test notification"`, `"Notifications are blocked"`, `"Add Happie to your home screen first"`, and the nudge's `"Get reminded when a to-do is due"`.

- [ ] **Step 1: Write the failing island tests**

Add to `islands/todos/TodoBacklog.test.tsx`:

```tsx
Deno.test("TodoBacklog — offers the reminder nudge when a to-do has a due date", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [
      todo({ id: "t1", dueAt: new Date(Date.now() + 86400000).toISOString() }),
    ],
  }));

  assertStringIncludes(html, "Get reminded when a to-do is due");
});

Deno.test("TodoBacklog — no nudge when nothing has a due date", () => {
  const html = render(h(TodoBacklog, {
    initialTodos: [todo({ id: "t1", dueAt: null })],
  }));

  assertFalse(html.includes("Get reminded when a to-do is due"));
});
```

**Note on what this can and cannot assert.** Task 7's hook already server-renders as `"default"` (it cannot call `detect()` without `navigator`), so SSR shows the nudge whenever the *dated to-do* condition holds. That is the half these two tests cover. The permission branches — denied, granted, needs-install — are not reachable in an SSR-only harness; do not try to test them, and do not restructure the hook to make them reachable.

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test --unstable-kv -A islands/todos/TodoBacklog.test.tsx`
Expected: FAIL — the nudge copy is absent.

- [ ] **Step 3: Write the notifications control**

Create `islands/shell/NotificationSetting.tsx`:

```tsx
import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { usePushNotifications } from "@/islands/shell/usePushNotifications.ts";

interface Props {
  /** Rendered as the More sheet's row; the sheet closes itself on tap. */
  onOpen?: () => void;
}

/**
 * The durable home for notifications, reachable from the More sheet.
 *
 * This exists so the contextual nudge on /todos can be safely dismissed: a nudge
 * you can dismiss and never recover is a trap. It also carries the test button,
 * which is the only way to confirm the pipeline on a real phone without waiting
 * for a cron tick.
 */
export default function NotificationSetting({ onOpen }: Props) {
  const { state, busy, enable, disable, sendTest } = useMemo(
    () => usePushNotifications(),
    [],
  );
  const open = useSignal(false);
  const message = useSignal<string | null>(null);

  const badge = (
    <span
      class="grid place-items-center bg-secondary-container text-on-secondary-container"
      style={{ width: 36, height: 36, borderRadius: "var(--md-shape-md)" }}
    >
      <Icon name="bell" size={18} />
    </span>
  );

  return (
    <>
      <ListItem
        leading={badge}
        headline="Notifications"
        trailing={<Icon name="chevron" size={18} />}
        onClick={() => {
          onOpen?.();
          open.value = true;
        }}
      />

      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Notifications"
      >
        {open.value && (
          <div class="flex flex-col gap-3 pb-1">
            {state.value === "unsupported" && (
              <div class="md-body-medium text-on-surface-variant">
                This browser can't show notifications.
              </div>
            )}

            {state.value === "needs-install" && (
              <div class="md-body-medium text-on-surface-variant">
                Add Happie to your home screen first — on iPhone and iPad,
                notifications only work once the app is installed.
              </div>
            )}

            {state.value === "denied" && (
              <div class="md-body-medium text-on-surface-variant">
                Notifications are blocked. You'll need to allow them for Happie
                in your browser settings.
              </div>
            )}

            {state.value === "default" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Get a nudge on this device when a to-do is due.
                </div>
                <Button
                  variant="filled"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const ok = await enable();
                    message.value = ok
                      ? "Reminders are on."
                      : "That didn't work. Try again?";
                  }}
                >
                  Turn on reminders
                </Button>
              </>
            )}

            {state.value === "granted" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Reminders are on for this device.
                </div>
                <Button
                  variant="tonal"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const res = await sendTest();
                    message.value = res && res.sent > 0
                      ? "Sent — it should arrive in a moment."
                      : "Couldn't send it. Try again?";
                  }}
                >
                  Send a test notification
                </Button>
                <Button
                  variant="text"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    await disable();
                    message.value = "Reminders are off for this device.";
                  }}
                >
                  Turn off on this device
                </Button>
              </>
            )}

            {message.value && (
              <div class="md-body-small text-on-surface-variant">
                {message.value}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
```

- [ ] **Step 4: Add the More sheet row**

In `islands/shell/MoreSheet.tsx`, import it:

```tsx
import NotificationSetting from "@/islands/shell/NotificationSetting.tsx";
```

And **add** it as a new row in the Household group, immediately after the coming-soon Settings row:

```tsx
        <NotificationSetting onOpen={onClose} />
```

`onOpen={onClose}` closes the More sheet as the notifications sheet opens, so two sheets are never stacked — the same reason the due picker is a sibling of the other sheets rather than nested inside one.

**Add, do not replace.** Leave the Members, Settings and Switch-household rows exactly as they are on `soon(...)`: notifications are not "settings", removing a coming-soon affordance is a product decision this task has no mandate for, and `soon` must stay in use or lint will flag it.

- [ ] **Step 5: Add the nudge to `/todos`**

In `islands/todos/TodoBacklog.tsx`, add the import and a dismissal signal:

```tsx
import { usePushNotifications } from "@/islands/shell/usePushNotifications.ts";
```

```tsx
  const push = useMemo(() => usePushNotifications(), []);
  const nudgeDismissed = useSignal(false);
```

Then, immediately inside the scrolling container and before the groups:

```tsx
        {!nudgeDismissed.value && push.state.value === "default" &&
          open.some((t) => t.dueAt !== null) && (
          <div class="flex flex-col gap-2 bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-lg)] px-4 py-3">
            <div class="md-body-medium">Get reminded when a to-do is due</div>
            <div class="flex gap-2">
              <Button
                variant="filled"
                loading={push.busy.value}
                onClick={async () => {
                  const ok = await push.enable();
                  if (!ok) say("Couldn't turn reminders on. Try again?");
                  else nudgeDismissed.value = true;
                }}
              >
                Turn on reminders
              </Button>
              <Button
                variant="text"
                onClick={() => (nudgeDismissed.value = true)}
              >
                Not now
              </Button>
            </div>
          </div>
        )}
```

- [ ] **Step 6: Document the pattern**

In `docs/ui-ux-patterns.md`, add a numbered section matching the file's existing `## N. Title` convention:

```markdown
## 14. Permission prompts are only ever asked on a tap

**Rule:** never call a permission API (`Notification.requestPermission`, and the
same goes for geolocation or camera if they ever arrive) outside a user gesture,
and never on page load. Offer it from a button the member taps, and give it a
durable home as well as any contextual nudge.

**Why:** a denial is effectively permanent — re-granting means digging through
browser site settings, which no family member will do — so there is exactly one
attempt to spend, and it should only be spent once intent is unambiguous. Safari
additionally *requires* a user gesture, so a prompt fired after an async save
silently fails. And a nudge that can be dismissed with no other route back is a
trap, which is why the More sheet row exists alongside it.

**Also handle** the states people actually land in: already denied (say so, don't
show a dead button), granted but nothing stored (subscribe silently), and — on
iOS — not yet installed to the home screen, where the API exists but cannot work.

**See:** `islands/shell/usePushNotifications.ts` and
`islands/shell/NotificationSetting.tsx`; the nudge in `islands/todos/TodoBacklog.tsx`.
```

- [ ] **Step 7: Run tests and check**

Run: `deno task check && deno task test`
Expected: both PASS, 359 passed (357 + 2).

- [ ] **Step 8: Commit**

```bash
git add islands/shell/NotificationSetting.tsx islands/shell/MoreSheet.tsx islands/todos/TodoBacklog.tsx islands/todos/TodoBacklog.test.tsx docs/ui-ux-patterns.md
git commit -m "feat(push): add the notifications control, nudge and test button"
```

---

### Task 9: Clear a to-do's notification when it is ticked off

**Files:**
- Modify: `islands/todos/TodoBacklog.tsx`

**Interfaces:**
- Consumes: the per-to-do `tag` convention (`todo-<id>`) from Task 5's sweep payload.
- Produces: nothing new.

Per-to-do tags make this possible, and it is why they were chosen: a member who can do two of three due to-dos right now ticks two off and the two they did visibly clear, leaving only what is still outstanding. Otherwise the shade shows to-dos already done — precisely the stale noise that trains people to swipe notifications away unread.

- [ ] **Step 1: Add the helper**

In `islands/todos/TodoBacklog.tsx`, add near the other helpers:

```tsx
  /**
   * Clear a to-do's notification from the shade once it's done. Only possible
   * because the sweep tags per to-do (`todo-<id>`); a shared tag would give no
   * way to address one. Best-effort: no service worker, no notifications, or an
   * unsupported browser all just mean nothing to close.
   */
  const clearNotificationFor = async (id: string) => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (!reg) return;
      const notes = await reg.getNotifications({ tag: `todo-${id}` });
      for (const n of notes) n.close();
    } catch {
      // Never let notification housekeeping break ticking a to-do off.
    }
  };
```

- [ ] **Step 2: Call it on a successful tick-off**

In the row's `RoundCheck` handler, after a successful `tickOff`:

```tsx
        onClick={async () => {
          const ok = isDone ? await unTick(t.id) : await tickOff(t.id);
          if (!ok) say("That didn't save. Try again?");
          else if (!isDone) await clearNotificationFor(t.id);
        }}
```

Only on tick-off, not un-tick: reopening a to-do should not resurrect a notification for a moment that has already passed.

- [ ] **Step 3: Verify check and the whole suite**

Run: `deno task check && deno task test`
Expected: both PASS, 359 passed (unchanged).

No test: `getNotifications` needs a live service worker registration and a real notification, neither available in an SSR-only harness. Verified on a device instead.

- [ ] **Step 4: Commit**

```bash
git add islands/todos/TodoBacklog.tsx
git commit -m "feat(push): clear a to-do's notification when it is ticked off"
```

---

## Verification before calling this done

- [ ] `deno task check` passes
- [ ] `deno task test` passes: **359** (324 baseline + 35 new)
- [ ] `scripts/spike-web-push.ts` was deleted after Task 1
- [ ] No private key appears anywhere in the diff — grep the branch for `VAPID_PRIVATE`
- [ ] `.env` is not committed (`git check-ignore .env` confirms it is ignored)
- [ ] Every pre-existing `todo.repo` test still passes untouched despite the delete cascade
- [ ] No file outside the File Structure table was modified

## What the controller can and cannot verify

**Can:** the service worker file is served; `navigator.serviceWorker.register` succeeds and `getRegistrations()` becomes non-empty; `GET /api/push/vapid-key` returns a key when env is set and `503` when not; subscription rows appear in KV when POSTed directly; the sweep's selection and claim logic via the test suite.

**Cannot, and must be checked on a real device by the maintainer:** the permission prompt, `pushManager.subscribe`, actual delivery, the notification's appearance, tap behaviour, and tick-off clearing. Notification permission is `denied` in the automation browser and cannot be re-granted from script — a control run confirmed synthetic paths prove nothing here. Report this plainly rather than implying a pass.

## Handover to the maintainer

Before this works in production, the maintainer must:

1. Generate a VAPID keypair — `deno eval 'import webpush from "npm:web-push"; console.log(webpush.generateVAPIDKeys())'`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:`) as Deno Deploy environment variables, following the pattern in `.github/workflows/migrate-prod-kv.yml`
3. On iPhone or iPad, **add Happie to the home screen** before turning reminders on
4. Open the app → More → Notifications → *Turn on reminders*, then *Send a test notification*

If the test notification arrives but a scheduled one does not, the fault is the sweep. If neither arrives, it is the subscription or the service worker. That split is the whole reason the test button exists.

## Deliberately not built

Re-read before adding anything: reminder offsets and their UI (4b), assignment-aware targeting (#17), offline asset caching, cleaning up the dead `pwa-sw.js` or the failing CDN `pwa-update` script, a due-index keyspace, and any change to `services/api.ts`.
