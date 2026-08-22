# To-do due dates — iteration 3

**Status:** approved, ready for an implementation plan
**Date:** 2026-08-04
**Module:** To-dos (`/todos`) — builds on iteration 1 (merged, PR #62)

## Summary

A to-do gains an optional **due moment**: `dueAt`, a full UTC instant. The flat
Open list becomes urgency-grouped sections, each row carries a due chip that
doubles as the control for setting or changing the date, and overdue to-dos are
marked without being shouted at.

This is the iteration that makes the module do its stated job — helping a
household remember one-off things — with notifications and reminders following
immediately after to complete it.

## What changed in the domain since iteration 1

Iteration 1 defined a to-do as covering both the one-off and the routine, with
recurrence planned as an attribute. **That was wrong and has been reversed:** a
to-do is strictly one-off, and routine recurring work is a **chore**, a separate
concept for a future module. See
[ADR 0003](../../adr/0003-todos-are-one-off-chores-are-a-separate-module.md), the
update note on [ADR 0001](../../adr/0001-one-household-backlog-no-todo-lists.md),
and the `To-do` / `Chore` entries in [`CONTEXT.md`](../../../CONTEXT.md).

This matters here because it changes what due dates are *for*. A one-off with a
deadline is the canonical case, and remembering is the purpose — which is why
reminders are the next iteration rather than a nice-to-have, and why windowing the
Done section is cheap.

New glossary terms: **Due**, **Overdue**.

## Decisions of record

- [ADR 0003](../../adr/0003-todos-are-one-off-chores-are-a-separate-module.md) —
  to-dos are one-off; chores are a separate module
- [ADR 0004](../../adr/0004-due-dates-are-utc-instants-timezone-is-presentation.md)
  — due dates are UTC instants; timezone is presentation only

Not given an ADR: the native picker (easily reversed — one component) and the
grouped-sections layout (presentation, reversible). Both are argued below.

## Scope

### In iteration 3

- `dueAt: string | null` on `TodoInterface`, plus the DTO changes
- Setting, changing and clearing a due moment from three places: the create sheet,
  the edit sheet, and a chip on the row
- Urgency-grouped Open sections: **Overdue → Today → This week → Later → No date**
- Overdue marked with error colour on the chip
- Done section windowed to the last 7 days, with "Show earlier (N)"
- A pure, unit-tested `groupOpenTodos(todos, now)` and a `formatDueAt(dueAt, now)`
- Repo ordering updated so a single-pass bucketer preserves order

### Out of iteration 3

| Iteration | Deferred work | Why it waits |
| --- | --- | --- |
| 4 | Notifications and reminders | Infrastructure with platform caveats; can't be verified in a browser preview. Needs VAPID keys, a push subscription store, a `push` handler in `static/pwa-sw.js` (currently pure Workbox caching), and a `Deno.cron` sweep |
| 5 | Assignment, `completedBy`, filters | Still hard-blocked on issue #17 |
| 6 | Labels | The birthday-party grouping case |
| later | A review flow for the household's weekly meeting | A view over existing data; additive |
| later | Per-household timezone, and a week boundary aligned to the meeting day | Both presentation-only settings; no household settings screen exists yet |
| never (here) | Recurrence | ADR 0003 — belongs to a future Chores module |

### Notes for the notifications iteration

Two things learned while designing this one, recorded so that iteration doesn't
start from the wrong primitive:

- **Deno KV queues are not supported on the new Deno Deploy**, which this project
  targets (commit `73e8091`). The "enqueue a delayed job when the due date is set"
  design is unavailable. `Deno.cron` *is* supported identically, so the shape is a
  periodic sweep — which is also more robust, since editing or deleting a to-do
  needs no queue cleanup.
- **A single `notifiedAt` marker is insufficient.** With reminders, one to-do has
  several fire-points (a week before, a day before, the due moment). Tracking needs
  to be per-fire-point.

## Data model

`models/todo/todo.interface.ts` gains one field:

```ts
export interface TodoInterface {
  // ...unchanged
  /**
   * When this is due, as a UTC instant, or null if it has no due moment. Always
   * a moment and never just a day — see docs/adr/0004. Read and written in the
   * viewer's timezone; nothing here or on the server knows what that zone is.
   */
  dueAt: string | null;
}
```

`TodoInput` gains `dueAt` so it can be set at capture time:

```ts
export type TodoInput = Pick<TodoInterface, "title" | "notes" | "dueAt">;
```

`CreateTodoDto` and `UpdateTodoDto` are derived and need no edit. `dueAt` is a
**required key with a nullable value**, matching `completedAt`, so every write
path states it.

### Existing records

`POST` composes `dueAt: null` when absent. Records written before this change have
no `dueAt` key at all, so reads must treat `undefined` and `null` alike. Rather
than scatter that, the repo normalises on read:
`dueAt: value.dueAt ?? null`. **No migration is needed** — this is an additive
optional field, unlike the household-scoping migration in #42.

## Ordering and grouping

This is the part with a real constraint, so it is specified precisely.

**The sort is timezone-independent; the grouping is not.** "Due at
`2026-08-05T16:00:00Z`" sorts identically everywhere, but whether that is *today*
depends on the viewer's zone, which the server does not know on first request
(ADR 0004). So the two are split:

**`TodoRepo.getAll` owns the order** (unchanged principle from iteration 1 —
callers never sort). The open-to-do ordering **changes**:

| Position | Rule |
| --- | --- |
| Open, dated | first, by `dueAt` **ascending** (soonest first) |
| Open, undated | after all dated, by `createdAt` **descending** (newest first) |
| Done | after all open, by `completedAt` **descending** |

Ties broken by `id` throughout, as the existing comparator already does.

Ordering dated-ascending-then-undated-newest is what lets a **single-pass
bucketer** preserve the right order inside every section for free: the dated
prefix arrives soonest-first so Overdue/Today/This week/Later each come out
ascending, and the undated tail arrives newest-first so **No date** keeps
iteration 1's quick-capture feedback intact.

**The existing repo ordering tests keep passing unchanged**, and must not be
touched. They construct only undated to-dos, and undated to-dos still sort
newest-created first — the new rule only reorders to-dos that *have* a `dueAt`.
New cases are **added** for dated-ascending order and the dated/undated boundary.
If an existing ordering test ever needs weakening to pass, the comparator is
wrong, not the test.

What the type change does break is compilation of the **test helpers**: once
`dueAt` is a required key, every helper that builds a `TodoInterface` or
`CreateTodoDto` must supply it. Four of them do:
`draft()` in `database/todo.repo.test.ts`, `seed()` in
`routes/api/todos/[id].test.ts`, `makeTodo()` in `hooks/useTodos.test.ts`, and
`todo()` in `islands/todos/TodoBacklog.test.tsx`. Each gains `dueAt: null` in its
defaults, which leaves every existing assertion behaving exactly as before.

**`groupOpenTodos(todos, now)`** is a new pure function in
`utils/todo-due.ts`, used by both the SSR loader and the island so both render
the same markup:

```ts
export type TodoGroupKey = "overdue" | "today" | "thisWeek" | "later" | "noDate";

export interface TodoGroup {
  key: TodoGroupKey;
  todos: TodoInterface[];
}

/** Buckets already-ordered open to-dos by urgency relative to `now`, in the
 *  timezone `now` is expressed in. Preserves input order within each group and
 *  omits empty groups. */
export function groupOpenTodos(
  todos: TodoInterface[],
  now: Date,
): TodoGroup[];
```

Boundaries, all in the viewer's local zone:

- **overdue** — `dueAt < now`. Includes earlier today. A to-do due at 09:00 seen
  at 18:00 is overdue, not today.
- **today** — `dueAt >= now` and on the same local calendar day as `now`
- **thisWeek** — after today, up to and including the **end of the coming Sunday**.
  Calendar weeks, not "within 7 days", because a household thinks in weeks.
  **When `now` is itself a Sunday**, that rule would collapse the group to nothing
  and push Monday into *later*, which reads wrongly on the very evening a
  household is most likely to be planning the week ahead. So on a Sunday the
  window extends to the end of the *following* Sunday, and the group always spans
  the week ahead.
- **later** — any dated to-do beyond that
- **noDate** — `dueAt === null`

Groups are computed at render. A page left open overnight goes stale until the
next interaction, navigation or pull-to-refresh; **no ticking timer** — the
staleness is cosmetic and a timer in an island is a cost with no benefit here.

Because the server buckets with its own clock (UTC on Deploy) and the client with
the device's, SSR and hydrated markup can put a boundary-adjacent to-do under
different headers until hydration settles it. The set and order are identical
either way. This is the accepted consequence in ADR 0004.

## Formatting

**`formatDueAt(dueAt, now)`** in `utils/todo-due.ts`, pure and unit-tested,
returns the compact row label. Rules:

- Always include the time: `"Fri 1 Aug, 09:00"`
- Omit the year unless `dueAt` falls in a different calendar year from `now`
- Use the device locale (no explicit locale argument) so issue #13's Dutch
  conversion is automatic

The app's only existing date helper is `relativeTime` in
`islands/shopping-lists.tsx:24` — local, unexported, and relative-only, so it
cannot serve an absolute due date. It is **left alone**; extracting and sharing it
is not this iteration's job.

## API

No new routes. Two handler changes in `routes/api/todos/`:

- `POST /api/todos` accepts an optional `dueAt` in the body and composes
  `dueAt: null` when absent
- `PATCH /api/todos/[id]` adds `dueAt` to its allow-list

Validation, matching the strictness the existing handlers settled on: `dueAt` must
be either `null` or a string that parses to a valid date; anything else is `400`.
The handler stores the normalised `new Date(value).toISOString()` rather than the
raw string, so a client sending an offset form (`"2026-08-05T18:00:00+02:00"`)
lands as a canonical UTC instant.

The `PATCH` allow-list stays an allow-list — `createdBy` and `createdAt` remain
unpatchable.

## Client and state

`services/api.ts` — no change. `TodoInput` and `UpdateTodoDto` already flow
through `api.todos.create` / `update`, and `dueAt` rides along.

`hooks/useTodos.ts`:

- `addTodo(input: TodoInput)` — already takes the input type; now carries `dueAt`
- **`setDueAt(id, dueAt: string | null): Promise<boolean>`** — new. Optimistic
  with rollback and an immediate `PATCH`, **not** debounced: picking a date is a
  discrete commit, like ticking off, not typing.
- Setting a due date can move a to-do between groups, which the island derives
  from `openTodos`, so no extra signal is needed
- The `openTodos` / `doneTodos` partition is unchanged

The existing mutation conventions hold: pessimistic create, debounced optimistic
text edits, optimistic tick/delete with rollback, failures surfaced by return
value and a `Snackbar`.

## UI

`islands/todos/TodoBacklog.tsx`:

**Rows** gain a due chip below the title, beside the existing notes hint. Dated:
`formatDueAt` output. Overdue: same text in **error colour on text and outline,
never a filled badge** — `bg-error` is the destructive-action colour in this
codebase (the Delete buttons) and that meaning is worth protecting. Undated: a
quiet `＋ due` affordance. Only the chip changes colour, never the row, so a
screen of overdue items doesn't become a wall of red and titles stay comfortable
to read.

The chip is its own tap target opening the picker directly. The row already has a
checkbox and a body tap, so the chip needs a real hit area (≥44px effective) and
must not swallow the body tap.

**Sections** replace the flat Open list: `Overdue → Today → This week → Later →
No date`, then Done. Rendered **only when non-empty**, matching how Done already
behaves. Headers use the same `md-label-medium uppercase` treatment as the
existing Done header.

**Done** shows only to-dos completed in the last 7 days — a **rolling**
`completedAt >= now - 7×24h`, not "since last Monday", so it needs no local-day
reasoning and no timezone at all — with a `Show earlier (N)` text button revealing
the rest. This is a **render** window, not a fetch window:
the loader still pulls the whole backlog, because keys are
`["todos", householdId, id]` and filtering by completion date would scan
everything anyway. If payload ever hurts, the fix is a date-bearing index or an
archive keyspace — decided against real data, not guessed now.

**The picker** is a native `<input type="datetime-local">`, with the *trigger*
styled on-brand. On mobile this opens the platform's own picker: familiar to every
family member including children, accessible and localised for free, and it
resolves local wall-clock time natively — which is exactly what ADR 0004 needs.
A compliant MD3 date picker (calendar grid, month paging, time selection, focus
management) is plausibly as much work as the rest of this iteration, for a control
the platform already provides better on the target device. The accepted cost: it
looks foreign next to the MD3 library on desktop, where the native control is
inline rather than a sheet.

Clearing is a **"Remove due date"** action in the picker surface, not a gesture on
the row — removing should take marginally more deliberation than setting.

Copy stays English and warm; issue #13 converts the app in one pass.

## Testing

- `utils/todo-due.test.ts` — the bulk of the new coverage, and pure so it needs
  no browser: each boundary (overdue vs today, today vs this week, the Sunday
  edge, `now` already Sunday, undated), order preservation within groups, empty
  groups omitted, and `formatDueAt`'s year-omission and time-always rules
- `database/todo.repo.test.ts` — **update** the existing open-ordering
  expectations to the new contract, and add dated-ascending, the dated/undated
  boundary, and `dueAt` surviving a partial update
- `routes/api/todos/index.test.ts` / `[id].test.ts` — `dueAt` on create, patching
  it, clearing it to `null`, offset-form normalisation to UTC, and `400` for a
  non-date
- `hooks/useTodos.test.ts` — `setDueAt` success, and rollback when the server
  rejects
- `islands/todos/TodoBacklog.test.tsx` — SSR shows section headers for populated
  groups only, a due chip, the `＋ due` affordance, and the Done window
- `deno task check` and `deno task test` green. Baseline on this branch: **274
  passing**

## Known hazards

1. **Reading records written before `dueAt` existed.** Normalise in the repo
   (`value.dueAt ?? null`), once, rather than defending at every call site.
2. **The repo's ordering change is a behaviour change.** Existing tests assert the
   old order; update them deliberately to the new contract. A test that has to be
   *weakened* to pass means the contract is wrong, not the test.
3. **`datetime-local` speaks local wall-clock, not UTC.** Its value has no zone,
   so converting is `new Date(localValue).toISOString()` on the way in and a
   locale-formatted local render on the way out. Never hand its raw value to the
   API and never render `dueAt` without converting.
4. **The chip must not steal the row's body tap.** Nested tap targets are how the
   row becomes frustrating; verify both independently in the browser.

## Verification

The browser checks that matter, on top of the suite: a to-do set due earlier today
appears under **Overdue** and not Today; a to-do due later today appears under
**Today**; the Sunday boundary puts a to-do in *This week* rather than *Later*;
the chip opens the picker and the row body still opens the edit sheet; clearing a
due date moves the to-do to **No date**; and a reload preserves grouping, chips
and the Done window.

Verify taps with **real pointer events**, not programmatic `.click()`. During
iteration 1 a synthetic click twice reported a passing focus behaviour that was
actually broken — untrusted events don't run the browser's default actions, so
they never move focus the way a genuine press does.
