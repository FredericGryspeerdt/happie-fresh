# To-do notifications — iteration 4a (delivery pipeline)

**Status:** approved, ready for an implementation plan
**Date:** 2026-08-05
**Module:** To-dos (`/todos`) — builds on iteration 3 (merged, PR #63)

## Summary

When a to-do's due moment arrives, the household's devices get a push
notification. This iteration builds the **whole delivery pipeline** and triggers it
from one fire-point — the due moment itself. Reminder offsets ("a week before")
are iteration 4b, on top of a pipeline already proven to work.

The pipeline: a VAPID keypair, push subscriptions stored per device, a minimal
service worker, a permission flow that only ever asks on a user gesture, a
`Deno.cron` sweep that claims before sending, and stale-subscription cleanup.

## Scope

### In iteration 4a

- `PushSubscriptionRepo` — subscriptions at `["push_subscriptions", householdId, endpointId]`
- `POST` / `DELETE /api/push/subscriptions`, and a `GET` for the VAPID public key
- A minimal push-only service worker: `push` and `notificationclick`, nothing else
- Client-side registration, permission request, and `pushManager.subscribe`
- A permission **nudge** on `/todos` plus a durable **More sheet** control
- A `Deno.cron` sweep every 5 minutes that claims `["todo_notifications", …]` markers and sends
- Stale-subscription cleanup on `404`/`410`
- Marker **cascade deletion**: deleting a to-do deletes its notification markers
- A **"Send a test notification"** button using the identical send path
- Ticking a to-do off **clears its notification**

### Out of iteration 4a

| Iteration | Deferred | Why |
| --- | --- | --- |
| 4b | Reminder offsets and their UI | The pipeline must be proven first; offsets only add fire-points |
| 5 | Assignment-aware targeting | Blocked on #17. Today every device in the household is notified, which is correct for a one-user household |
| — | Offline asset caching | `static/pwa-sw.js` stays dormant; see "Which service worker" below |
| — | Cleaning up the dead `pwa-sw.js` and the failing CDN `pwa-update` script | Unrelated to notifications and touches every page's `<head>`; own ticket |
| — | A due-index keyspace | ADR 0005 — decided with real numbers, and it should index fire-points, not to-dos |

## Decisions of record

- [ADR 0005](../../adr/0005-push-delivery-is-a-claim-based-cron-sweep.md) — push
  delivery is a claim-based cron sweep

No new `CONTEXT.md` terms. This iteration adds infrastructure, not domain
concepts: a household member does not say "fire-point". **Reminder** enters the
glossary in 4b, when it becomes something they can see and set.

Not given an ADR, and why: the push-only service worker (trivially reversible),
household-scoped subscription keys (mirrors every other aggregate, and the
rejected alternative is argued below), and the permission flow (presentation).

## The unknown to resolve first

**Does `web-push` actually run on Deno Deploy?** Its API is confirmed
(`generateVAPIDKeys`, `setVapidDetails`, `sendNotification`, and `404`/`410`
meaning the subscription is dead), but it is a Node module leaning on Node's
`crypto`, and Deno's Node compatibility on Deploy has not been verified for it
here.

The plan's **first task is a spike** that proves a real push can be sent from Deno
before anything is built on top. If it cannot, the alternative is a Deno-native
Web Push implementation or hand-rolling RFC 8291 encryption — a materially
different piece of work, and far cheaper to discover on day one than after the
subscription store, the service worker and the sweep all assume it.

## Why not a queue

See ADR 0005. Short version: KV queues are unsupported on the new Deno Deploy,
which this project targets, and the sweep is the better shape regardless because
nothing needs cancelling when a to-do is edited, ticked off or deleted.

## Data model

### Push subscriptions

New: `models/push-subscription/push-subscription.interface.ts`.

```ts
export interface PushSubscriptionInterface {
  /** Hash of the endpoint URL — see "Why the endpoint is hashed". */
  id: string;
  householdId: string;
  /** The user whose device this is. Not used for targeting yet; see #17. */
  userId: string;
  /** The push service URL this device is reachable at. */
  endpoint: string;
  /** From the browser's PushSubscription: the ECDH public key. */
  p256dh: string;
  /** From the browser's PushSubscription: the auth secret. */
  auth: string;
  createdAt: string;
}

export type CreatePushSubscriptionDto = Omit<PushSubscriptionInterface, "id">;

/** What the client sends. The server derives id, householdId, userId, createdAt. */
export type PushSubscriptionInput = Pick<
  PushSubscriptionInterface,
  "endpoint" | "p256dh" | "auth"
>;
```

**Key:** `["push_subscriptions", householdId, id]`

**Why household-scoped, with `userId` on the record.** The sweep starts from a
**to-do**, and every to-do knows its `householdId` — so "who do I notify about
this" is one prefix scan with no joins. User-scoped keys would invert that and run
into the fact that **there is no reverse index from household to users**; listing a
household's people needs a full `["users"]` scan today. That gap is real but
belongs to #17, which owns member profiles and will likely key on *members* rather
than users; it has been recorded there
([#17 comment](https://github.com/FredericGryspeerdt/happie-fresh/issues/17#issuecomment-5195631397)).

**Why the endpoint is hashed into the id.** A device re-subscribing — permission
re-granted, browser rotates the endpoint, site data cleared — must not create a
second row, or one phone gets two notifications. Hashing the endpoint makes the
write an idempotent upsert. A random UUID would need a scan-and-dedup on every
subscribe. Use SHA-256 of the endpoint, hex-encoded, via `crypto.subtle`.

**Subscriptions outlive sessions.** This app's sessions expire after 24 hours; a
subscription must survive that, so it is its own aggregate and never hangs off a
session.

### Notification markers

No model file — this is internal bookkeeping, not a domain record.

**Key:** `["todo_notifications", householdId, todoId, firePointId]`
**Value:** `{ claimedAt: string; sent: boolean }` — `sent: false` is how a
past-the-cutoff fire-point records that it was deliberately suppressed rather than
delivered, which matters when someone asks why no notification arrived.

**Markers cascade with the to-do.** `TodoRepo.delete` must also prefix-scan
`["todo_notifications", householdId, todoId]` and delete what it finds, batched in
one atomic like `CategoryRepo.reorder` does. Orphans would be tiny but would
accumulate forever, and a to-do id is never reused so they could never be
reclaimed.

`firePointId` is `"due@<the ISO instant>"`, e.g. `due@2026-08-06T07:00:00.000Z`.
**The instant is part of the id deliberately** — keyed on `"due"` alone,
rescheduling a to-do that had already notified would never notify again, and a
member who moves something to next week plainly wants reminding next week. In 4b
an offset becomes `-P1D@<instant>`.

## The sweep

Registered with `Deno.cron` at module scope in `main.ts`, which is where Deno
Deploy extracts cron definitions at deploy time.

```ts
Deno.cron(
  "todo-due-notifications",
  "*/5 * * * *",
  { backoffSchedule: [1000, 5000, 10000] },
  sweepDueNotifications,
);
```

The retries are what make the atomic claim load-bearing rather than theoretical:
a handler that fails half-way through a batch will be re-run over the same
fire-points.

**Cadence: every 5 minutes.** The floor is 1 minute, but a to-do due at 09:00
arriving by 09:05 is indistinguishable from punctual for household work, at a
fifth of the reads. Cron runs in **UTC**, which needs no special handling: the
sweep compares instants, and per ADR 0004 nothing about storage is
timezone-dependent.

Each run:

1. Scan `["todos"]` across all households. In-memory filter to open to-dos
   (`completedAt === null`) with a non-null `dueAt`.
2. For each, the fire-point is `dueAt`. Consider it **only if**
   `now - 1 hour <= dueAt <= now`.
3. Anything older than an hour: **claim the marker without sending.** It is then
   recorded as handled and can never fire late. The to-do still reads as
   **Overdue** in the app.
4. For each in-window fire-point, attempt the atomic claim. If it fails, another
   run or a retry already has it — skip.
5. For each won claim, send **one notification per to-do** to every subscription in
   that household. Load each household's subscriptions **once per run**, not once
   per to-do — three to-dos due at the same 09:00 default is the common case, and
   re-reading the same rows three times is pure waste.
6. On `404`/`410` from the push service, **delete that subscription**.

**Why the scan and not an index:** at one household and tens of to-dos this is a
handful of reads per run; an index would need maintaining across create,
reschedule, tick-off and delete — four drift sites — and gets *worse* in 4b, where
you would be indexing fire-points rather than to-dos. Recorded in ADR 0005 as a
decision to revisit with real numbers.

## Delivery

**One notification per to-do**, not collapsed. The create sheet defaults to 09:00
tomorrow, so several to-dos sharing an instant is the common case rather than the
edge case — but separate notifications are separately *actionable*: a member who
can do two of three right now ticks two off and gets two small wins, where a
single summary is one more chore.

- **title** — the to-do's title
- **body** — `"Due now"`
- **tag** — `todo-<id>`

**The tag must be per to-do.** A shared tag would make each new notification
replace the last, collapsing three due to-dos back into one and defeating the
decision above. Per-to-do tags keep them separate while still meaning a re-send
for the *same* to-do replaces rather than duplicates. iOS and Android group
same-app notifications into a stack on their own.

This title/body split extends to 4b unchanged: a reminder is the same title with
body `"Due in a week"`.

**On tap** (`notificationclick`): focus an already-open Happie window if there is
one, else open `/todos` — the standard `clients.matchAll({ type: "window",
includeUncontrolled: true })` then `focus()`-or-`openWindow()`. No deep link to the
individual to-do, because there is no per-to-do route; they open in a sheet on
`/todos`.

**Ticking off clears the notification.** Per-to-do tags make this possible:
on a successful tick-off, `getNotifications({ tag: "todo-<id>" })` on the service
worker registration and close what comes back. Otherwise the shade shows to-dos
already done, which is precisely the stale noise that trains people to swipe
notifications away unread.

## Which service worker

**A new minimal push-only worker**, `static/push-sw.js`: a `push` handler and a
`notificationclick` handler, nothing else. Registered explicitly from the client.

Verified empirically before deciding: **no service worker is registered at all
today** — `navigator.serviceWorker.getRegistrations()` returns `[]`, and the CDN
`<pwa-update>` element from `routes/_app.tsx` is not even present in the DOM, so
that script is failing silently. `static/pwa-sw.js` is dead code. Scope `/` is
therefore free and there is no existing registration to conflict with.

**Why not reuse `pwa-sw.js`.** It would switch on app-wide asset caching for the
first time as a side effect of shipping notifications — HTML `NetworkFirst`, JS and
CSS `StaleWhileRevalidate`, so after a deploy a member could be served stale
islands until a second load. That is a behavioural change to every page, with its
own testing needs, arriving inside a PR about due dates. If offline caching is
worth having it deserves an iteration where stale-asset behaviour is the thing
under test.

## Permission flow

**Never prompt automatically.** Two constraints force this: a denial is
near-unrecoverable (re-granting means digging through browser site settings), and
Safari requires `Notification.requestPermission()` to be called from a **user
gesture**, so a prompt fired after an async save would simply fail. Both surfaces
below are buttons a member taps.

**A contextual nudge on `/todos`**, shown only when the household has at least one
dated to-do **and** `Notification.permission === "default"`. That is the one moment
the intent is unambiguous — they have just started putting due dates on things.
Dismissible.

**A durable control in the More sheet**, alongside the existing Shopping and
Loyalty cards rows. This is what makes the nudge safely dismissible; a nudge you
can dismiss and never recover is a trap.

Three states, all handled explicitly:

- **`default`** — offer it.
- **`denied`** — say plainly that notifications are blocked and must be changed in
  browser settings. Do not show a button that cannot work.
- **`granted` with no stored subscription** — subscribe silently, no UI. Happens
  after clearing site data or on a new device.

**iOS needs the PWA installed.** `pushManager.subscribe()` only works in an
installed PWA on iOS (16.4+); in a plain Safari tab it fails. Detect that case and
say *add Happie to your home screen first*, rather than surfacing an error nobody
can act on. Getting this message right is most of the difference between "it
doesn't work on my iPhone" and a member who knows what to do.

## API

| Route | Method | Body | Response |
| --- | --- | --- | --- |
| `/api/push/vapid-key` | `GET` | — | `200 { publicKey }` |
| `/api/push/subscriptions` | `POST` | `PushSubscriptionInput` | `201` the stored subscription |
| `/api/push/subscriptions` | `DELETE` | `{ endpoint }` | `204`, `404` if unknown |
| `/api/push/test` | `POST` | — | `200 { sent, failed }` |

The VAPID **public** key is public by definition, so serving it is fine. It needs
an endpoint rather than SSR props because the More sheet lives in the app shell,
where there is no route loader to inject through.

Handlers follow the established shape: `define.handlers`, `householdId` from
`ctx.state`, and the shared `json` / `noContent` / `badRequest` / `notFound`
helpers. `DELETE` takes the endpoint in the body rather than the path because the
client holds the endpoint, not the hash.

**`/api/push/test` must call the identical send path as the sweep** — same
subscription lookup, same `web-push` call, same `404`/`410` handling — differing
only in payload. A separate test path would verify code nobody uses in anger,
which is worse than nothing because it produces false confidence.

## Secrets

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:`), read via
`Deno.env.get`, following the GitHub-secrets convention already used by
`migrate-prod-kv.yml`.

A keypair is generated **once** and stored. Local development uses a keypair in
the gitignored `.env`. **Production values are the maintainer's to set** — no
private key goes near a commit. If the env vars are absent, the sweep and the test
endpoint must **no-op with a clear log line** rather than throwing on every cron
tick.

## Testing, and the limits of it

What can be tested here:

- `PushSubscriptionRepo` against in-memory KV: upsert idempotency for a repeated
  endpoint, household isolation, delete by endpoint
- The endpoint-hash helper: same endpoint → same id, different → different
- The sweep's **fire-point selection**, as a pure function over `(todos, now)`:
  in-window, older-than-an-hour, already-claimed, done, undated
- The marker claim: a second claim for the same fire-point fails
- API handlers, in the established direct-invocation style: subscribe, duplicate
  subscribe, delete, unknown delete, `401` without a household
- Stale cleanup: a stubbed `404`/`410` deletes the subscription

**What cannot be verified in this environment, and must be checked on a real
device.** Notification permission is `denied` in the automation browser and cannot
be re-granted from script, so: the permission prompt, subscription creation,
actual delivery, notification appearance, tap behaviour, and tick-off clearing are
all **unverifiable here**. That is a materially larger unverified surface than any
previous iteration, and the reason the test-notification button is close to
essential rather than a nicety — it is the only way the maintainer can confirm the
pipeline on their own phone in one tap instead of waiting for a cron tick and
guessing which half failed.

`deno task check` and `deno task test` must pass. Baseline on this branch: **324
passing**.

## Known hazards

1. **The spike gates everything.** Do not build on `web-push` until a real push has
   been sent from Deno.
2. **Missing VAPID env must not throw on every cron tick.** No-op with a log line.
3. **The claim must precede the send**, never follow it. Claim-then-send can drop a
   notification if the send fails; send-then-claim can send twice, which is worse.
4. **`404`/`410` cleanup is not optional.** Without it a household that clears site
   data accumulates dead endpoints and every run wastes requests on them forever.
5. **The endpoint hash must be stable.** A change in how it is derived orphans every
   existing subscription and silently duplicates devices.
