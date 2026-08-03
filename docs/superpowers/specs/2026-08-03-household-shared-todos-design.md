# Household shared to-dos — iteration 1

**Status:** approved, ready for an implementation plan
**Date:** 2026-08-03
**Module:** To-dos (`/todos`)

## Summary

The to-dos module gives a household one shared backlog of things that need doing.
Iteration 1 is deliberately a plain CRUD slice: create, read, update, delete, and
tick off. Ticking off means *we did this*; deleting means *this never needed to
happen*. Nothing is assigned to anyone yet, nothing is due, nothing recurs.

The nav tab and route already exist as a placeholder — `todos` is a live tab
(`config/navigation.ts:41`) and `routes/todos/index.tsx` renders `ComingSoon`.
This work replaces that placeholder.

## Domain language

Defined in [`CONTEXT.md`](../../../CONTEXT.md): **Household**, **To-do**,
**Backlog**, **Done**, **Not needed**. The spec uses those terms exactly; in
particular a to-do is never called a task, chore or item, and the backlog is
never called a list.

## Decisions of record

Two decisions deviate from the shopping module sitting next to them and are
written up as ADRs:

- [ADR 0001](../../adr/0001-one-household-backlog-no-todo-lists.md) — one
  household backlog, no to-do lists
- [ADR 0002](../../adr/0002-completion-is-a-timestamp-not-needed-is-a-deletion.md)
  — completion is a timestamp; "not needed" is a deletion

Decisions **not** given an ADR, and why: household scoping matches
`LoyaltyCardRepo` and had no real alternative; the module's layering choices
(below) are cheap to reverse and issue #51 owns them.

## Scope

### In iteration 1

- `/todos` replaces the `ComingSoon` placeholder: SSR loader plus
  `islands/todos/TodoBacklog.tsx`, mirroring `routes/shopping/index.tsx` → island
- Create via the FAB → a sheet that **stays open** between saves for rapid capture
- Read: an Open section and a Done section
- Update title and notes via the row → the same sheet in edit mode
- Delete, guarded by a confirmation bottom sheet
- Tick off and un-tick
- `TodoRepo`, the API routes, the `todos` API-client namespace, `hooks/useTodos.ts`
- Repo tests and an island SSR test
- An empty state for a household with no to-dos

### Out of iteration 1

| Iteration | Deferred work | Why it waits |
| --- | --- | --- |
| 2 | Assignment to members, `completedBy`, filters (title, assignee, not-done) | Hard-blocked on issue #17 — a household cannot yet hold more than one member, so there is nothing to assign to |
| 3 | Due dates, today/overdue views, windowing the Done section | A due date is not one field; it brings sorting, overdue styling and views with it |
| 4 | Recurrence | What monthly bills, the weekly bins and yearly appointments actually need |
| 5 | Labels | The "plan a birthday party" grouping case |
| — | Dutch copy | English now; issue #13 converts the app in one pass |
| — | Home-screen counts, nav badges, activity log | Not asked for |
| — | `createKvRepo<T>` | Issue #51, app-wide |

### The membership caveat

A household currently contains exactly one user. `UserInterface` carries a single
`householdId` FK and `UserRepo.create` always mints a brand-new household
(`database/user.repo.ts:24`), so it cannot place a user into an existing one;
there is no signup route and `UserRepo.create` has no callers in app code.

Iteration 1 is therefore **architecturally** shared but **observably**
single-user. Scoping by `householdId` from the start costs nothing today —
`ctx.state.householdId` is already resolved for every authenticated request
(`routes/_middleware.ts:38`) — and avoids the migration that issue #42 is
currently paying for on the catalogue.

## Data model

New: `models/todo/todo.interface.ts`, barrelled through `models/todo/index.ts` and
`models/index.ts`, following the existing `XxxInterface` + DTO conventions.

```ts
export interface TodoInterface {
  id: string;
  householdId: string;
  title: string;
  notes?: string;
  createdBy: string;          // userId
  createdAt: string;          // ISO
  completedAt: string | null; // null = not done
}

// Derived type for creation (No ID)
export type CreateTodoDto = Omit<TodoInterface, "id">;

// What the client may send. Excludes householdId/createdBy/createdAt so the
// client cannot spoof ownership — mirrors LoyaltyCardInput.
export type TodoInput = Pick<TodoInterface, "title" | "notes">;

export type UpdateTodoDto = Partial<Omit<TodoInterface, "id" | "householdId">>;
```

Notes on the shape:

- `completedAt` is a **required key with a nullable value**, not an optional
  field. Every write path must state which it is; optional-and-absent makes "not
  done" indistinguishable from "this record predates the field".
- `createdBy` is required, matching `ShoppingListInterface` (dishes, categories
  and cards all make it optional, which is the weaker choice). It stays a userId
  permanently and correctly, because creating a to-do requires a login. It is
  *completing* and *assignment* that will point at members.
- `UpdateTodoDto` uses the newer of the two update-DTO shapes in the codebase —
  `Partial<Omit<I, "id">>` with the id passed as a separate argument, as
  `dish` and `loyalty-card` do — not the older `Pick<I,"id"> & Partial<...>`.

## Persistence

New: `database/todo.repo.ts`. Hand-rolled, copying `database/loyalty-card.repo.ts`
— the cleanest household-scoped repo in the codebase. Static methods, `getKv()`
at the top of each, `householdId` as the first parameter of every method **except
`create`**, which takes the DTO alone because `CreateTodoDto` already carries
`householdId` (exactly as `LoyaltyCardRepo.create` does).

Key: `["todos", householdId, id]`

| Method | Behaviour |
| --- | --- |
| `create(data: CreateTodoDto)` | mints `crypto.randomUUID()`, `kv.set`, returns the to-do |
| `getAll(householdId)` | prefix scan, **sorted** (below) |
| `getById(householdId, id)` | returns `null` when absent |
| `update(householdId, id, patch: UpdateTodoDto)` | `mergeDefinedPatch`, then re-read via `getById`; returns `null` when absent |
| `delete(householdId, id)` | hard delete |

**`getAll` sorts; callers never do.** Open to-dos first, newest `createdAt`
first; then done to-dos, most recent `completedAt` first. One stable order means
the SSR render and the hydrated view agree, and the island only has to find the
partition point. This is a deliberate fix, not a copy:
`ShoppingListItemRepo.getAll` does a bare prefix scan
(`database/shopping-list-item.repo.ts:23`), so with random UUID keys shopping
items come back in effectively arbitrary order.

`update` uses `mergeDefinedPatch` (`database/merge-patch.ts:10`) so a partial
patch cannot clobber omitted fields. Like every repo here except
`WeeklyMenuRepo`, `update` is a non-atomic read-modify-write; that matches the
established pattern and is acceptable while a household has one user. It is worth
revisiting when #17 makes concurrent writers real.

## API

New response helpers at `utils/http.ts`, re-exported from `utils/index.ts`:
`json(data, status)`, `noContent()`, `badRequest(msg)`, `notFound(msg)` — exactly
the set issue #51 proposes, no more. A `201` is `json(todo, 201)`; there is no
separate `created` helper. These are the uncontroversial half of #51 — additive,
they touch no existing code, and they remove the repeated
`new Response(JSON.stringify(...))` from four new handlers instead of adding a
ninth copy of it.

| Route | Method | Body | Response |
| --- | --- | --- | --- |
| `/api/todos` | `GET` | — | `200` `TodoInterface[]` |
| `/api/todos` | `POST` | `TodoInput` | `201` `TodoInterface`, `400` on blank title |
| `/api/todos/[id]` | `PATCH` | `UpdateTodoDto` | `200` `TodoInterface`, `404` |
| `/api/todos/[id]` | `DELETE` | — | `204`, `404` |

Every handler reads `householdId` from `ctx.state` and passes it to the repo. The
client never sends a `householdId`; `POST` composes the `CreateTodoDto` from the
`TodoInput` plus `householdId`, `createdBy` (the session user) and `createdAt`
server-side.

`UpdateTodoDto` is the **repo's** patch type and is deliberately wider than the
wire contract. The `PATCH` handler picks only `title`, `notes` and `completedAt`
off the parsed body and discards everything else, so a client cannot patch
`createdBy` or `createdAt` even though the repo type permits it.

Unauthenticated `/api/*` requests already 401 in middleware
(`routes/_middleware.ts:44`), so handlers do not repeat that check.

## Client and state

- `services/api.ts` gains a `todos` namespace beside the existing seven.
  The `services/api/<entity>.ts` split from issue #51 is **not** started here —
  it is cheap and safe done all at once, and confusing done one-eighth of the way.
- `hooks/useTodos.ts` holds two signals, `openTodos` and `doneTodos`, splitting
  the sorted array from the server on `completedAt === null`. Because `getAll`
  already returns open to-dos before done ones, this is a partition, not a
  re-sort. Mirrors `hooks/useShoppingList.ts:18`.

### Mutation strategy

Per §1 of `docs/ui-ux-patterns.md`:

| Action | Strategy |
| --- | --- |
| Create | **Pessimistic** — await the server, adopt the returned to-do. The server mints the id. |
| Edit title/notes | **Optimistic**, debounced and merged via `utils/debounce-update.ts`, flushed when the sheet closes |
| Tick off / un-tick | **Optimistic**, a single immediate `PATCH { completedAt }` — a discrete toggle, never debounced. Ticking off first holds the row for the ~300ms exit animation (§6); un-ticking is instant, mirroring `uncheckItem` |
| Delete | **Optimistic**, after the confirmation sheet |

Every optimistic path snapshots, rolls back on failure, and surfaces a `Snackbar`
(§3). Ticking off uses the optimistic exit animation from §6 so the row visibly
leaves the Open section before landing in Done.

## UI

`routes/todos/index.tsx` — SSR loader calls `TodoRepo.getAll(householdId)` and
passes the result to the island. `/todos` is a top-level tab, so it takes the
default section-title app bar and sets no `ctx.state.appBar`, exactly like
`/shopping`.

`islands/todos/TodoBacklog.tsx` — named for the domain, matching
`islands/dishes/DishCatalogue.tsx` and `islands/cards/LoyaltyWallet.tsx`.

- **Open section** — each row is a `RoundCheck` plus the title. If the to-do has
  notes, a truncated hint sits under the title with the 📝 treatment from
  `islands/items.tsx:247`. Tapping the row opens the edit sheet; tapping the
  `RoundCheck` ticks it off.
- **Done section** — same rows, visually secondary, titles struck through. No
  bulk clear (ADR 0002).
- **FAB** — `Fab` with `icon="plus"`, `label="New to-do"`, fixed
  `right-4 z-30` at `bottom: calc(96px + env(safe-area-inset-bottom))`, matching
  every other module's FAB verbatim. Opens the create sheet.
- **Create sheet** — title field (autofocused) and notes textarea. Saving adds
  the to-do, clears the fields and keeps focus so several to-dos can be captured
  in a row; the sheet closes via its Done button or the scrim. Keeping focus
  between saves is deliberate: it stops the mobile soft keyboard dismissing, the
  class of problem behind the keyboard primer at `islands/items.tsx:705` and the
  autofocus regression in PR #45.
- **Edit sheet** — the same `Sheet`, holding title, notes, a filled Done button
  and an error-variant Delete, mirroring `islands/items.tsx:551`.
- **Delete confirmation** — a bottom `Sheet`, per the component-library rule that
  confirmations use a sheet rather than a dialog or `confirm()`
  (`docs/ui-ux-patterns.md:327`). Issue #49 may later standardise the surface
  app-wide; this follows the current house pattern.
- **Empty state** — icon, title and warm blurb, in the same shape as
  `components/md3/ComingSoon.tsx`. There is no generic `EmptyState` component
  today; generalising `ComingSoon` into one is a reasonable follow-up but is out
  of scope here.

Copy stays English and warm enough for a child to read, per the product ethos.

## Known hazards

Three specific things to get right, each learned from existing code:

1. **A blank title must not be written.** Shopping never hit this — a list item's
   name comes from the catalogue, so it has no editable required field. With
   per-keystroke debounced writes, select-all-delete would `PATCH` an empty
   title. Suppress the write while the title is blank and keep the last non-empty
   value when the sheet closes. `POST` rejects a blank title with `400`.
2. **Deleting must cancel any pending debounced write for that to-do**, or a late
   flush resurrects a deleted row. `clearCheckedItems` already does exactly this
   (`hooks/useShoppingList.ts:195`) for the same reason.
3. **Sorting lives in the repo, not the island** — see `getAll` above.

## Testing

- `database/todo.repo.test.ts` — create, `getAll` ordering (open before done,
  each correctly sorted), `getById`, partial `update` not clobbering omitted
  fields, `delete`, and **household isolation** (one household never sees
  another's to-dos). Follows the conventions in
  `database/shopping-list-item.repo.test.ts`: `Deno.env.set("KV_PATH", ":memory:")`
  at module load, `sanitizeResources: false` per test, distinct ids per test
  because the KV singleton is process-wide.
- `islands/todos/TodoBacklog.test.tsx` — SSR render shows open and done to-dos,
  the "New to-do" FAB label, and the empty state when there are none. Follows
  `islands/dishes/DishCatalogue.test.tsx`.
- `deno task check` must pass (`deno fmt --check && deno lint && deno check`).

## Roadmap

Iteration 1 ships a backlog. The axes that make it genuinely useful arrive in
order of how much they need each other:

1. **Iteration 2 — assignment and filters.** Blocked on #17. Adds
   `assigneeIds` (member ids) and `completedBy`, plus filtering by title,
   assignee and not-done.
2. **Iteration 3 — due dates.** Adds `dueDate`, overdue styling, sort-by-due, and
   the today/this-week views. Also the natural moment to window the Done section.
3. **Iteration 4 — recurrence.** An attribute on a to-do, not a separate type
   (see `CONTEXT.md`: a routine to-do is one that comes back, not a different
   kind of thing). This is what monthly bills, the weekly bins and yearly
   appointments need; it depends on `completedAt` to know when the last
   occurrence was done.
4. **Iteration 5 — labels.** Composable grouping for the birthday-party case,
   following the `DishTagGroupInterface` pattern.

Reconsider splitting **Chore** from **To-do** only if chores grow features
to-dos do not want — rotation between members, or points and rewards for
children.
