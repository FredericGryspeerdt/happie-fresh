# Weekly Menu Assembly from Dish Catalogue — Design

**Date:** 2026-07-31
**Status:** Draft (awaiting review)
**Issue:** #41 (Implement Weekly Menu Assembly from Dish Catalogue)
**Module:** Menu planner (`/menu`) — currently the dish catalogue from #39
**Design source:** `md3-menu.jsx` (Claude Design project "Happie", `PlanScreen` / "This week")

---

## 1. Problem & context

Issue #41 asks users to **manually assemble a weekly menu** by picking dishes
from the existing dish catalogue: browse & select dishes, add them to the week,
remove them, and organise them flexibly (no strict Mon–Sun grid). It complements
the meal-**suggestion** engine (#14), which stays out of scope here.

The dish catalogue already exists from #39 — `islands/dishes/DishCatalogue.tsx`,
`hooks/useDishes.ts`, `DishRepo` / `DishTagGroupRepo`, `routes/api/menu/dishes.ts`,
and `routes/menu/{index,new,[id]}`. `/menu` currently lands on that catalogue.
This feature adds the **weekly-menu layer on top of the catalogue**.

The prototype `md3-menu.jsx` frames Menu as a planner with two sub-tabs — **This
week** (the plan) and **Dishes** (the catalogue). The prototype keeps the plan in
ephemeral React state and mixes in the suggestion engine; this design persists
the plan and implements only the manual half.

The shopping module (`ShoppingListRepo` → `routes/api/shopping/lists.ts` →
`useShoppingList`, with `services/api.ts` + optimistic-signals hooks) is the
template for the repo → API → hook stack, and it already reads
`ctx.state.householdId`.

## 2. Goals / non-goals

**Goals**
- A single **persisted weekly menu per household**, KV-backed, shared by members.
- **Add** a dish to the week from the catalogue (Add / Added toggle per dish).
- **Remove** a dish from the week (from the plan view, and by toggling in the
  catalogue).
- **Optional weekday pinning** per dish (Any day / Mon–Sun) for flexible
  organisation; pinned dishes sort into weekday order.
- **Clear** the whole week (with undo).
- Reframe `/menu` as the planner: **This week** is the default landing, with a
  sub-tab to the **Dishes** catalogue at `/menu/dishes`.
- Reuse existing conventions: repos, `services/api.ts`, MD3 components, the
  optimistic-signals hook pattern, `beginBusy/endBusy` loading, `navigateTo`.

**Non-goals (v1)**
- Meal **suggestion** engine / variety balancing / "Suggest a plan" sheet (#14).
- **"Add ingredients to groceries"** payoff (menu → shopping-list write). The data
  model (`dish.ingredientIds`) already makes this possible later; not built here.
- **Multi-select batch-add** (the prototype's long-press selection mode). v1 ships
  the per-dish Add/Added toggle only.
- **Drag-reordering** of plan rows. Order = weekday pins, then add order.
- A dish appearing **more than once** in the week (deduped by `dishId`).
- Dish CRUD (done in #39). Household scoping of **dishes/tags** themselves (that
  is #42; only the *weekly menu* is household-scoped here — see §10).
- Per-dish emoji / hardcoded type·prep·side taxonomy from the prototype — real
  dishes carry `tagValueIds`; plan rows render those real tag values.

## 3. Product alignment

Happie is a collaborative household manager; the weekly menu is a **shared
household artifact** every member sees and edits. Hence the household scoping and
action-based (non-clobbering) writes. UX stays warm and simple: tap Add on a
dish, see it appear under "This week", optionally pin a day from a friendly
bottom sheet, remove with one tap. Mobile-first — the plan is a single scrollable
column of cards sized for a phone.

## 4. Data model

New model directory `models/menu/`, exported from `models/index.ts`.

```ts
// models/menu/weekly-menu.interface.ts
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface MenuEntryInterface {
  id: string;            // stable entry id (crypto.randomUUID)
  dishId: string;        // → ["dishes", dishId]
  day: Weekday | null;   // optional weekday pin; null = "Any day"
}

export interface WeeklyMenuInterface {
  householdId: string;
  entries: MenuEntryInterface[];
  updatedAt?: string;    // ISO string, stamped on each mutation
}
```

**Rationale**
- One KV entry holds the whole menu (`entries` embedded) — the menu is small and
  always read/written together, mirroring how a `DishTagGroup` embeds its values.
- Entries carry a stable `id` so weekday-pin and remove target a specific row
  independently of `dishId`, and so list rendering has a stable key.
- Deduped by `dishId` (a dish is in the week or not), matching the prototype's
  toggle semantics and keeping the catalogue's Add/Added state unambiguous.
- No `emoji`/`type`/`prep`/`side` — those are prototype-only. Tag pills on a plan
  row derive from the dish's real `tagValueIds` resolved against `tagGroups`.

**KV key** (household-scoped): `["weekly_menu", householdId]`.

There is no create-with-id DTO: the menu is a singleton per household. Mutations
are the repo actions in §6.1; a fresh household reads an empty
`{ householdId, entries: [] }` that is only persisted on first mutation.

## 5. Weekday ordering

`WEEKDAY_ORDER: Weekday[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`, defined
once alongside the model and reused by the hook's sort and the day picker.

Plan display order: entries **pinned** to a weekday first, sorted by
`WEEKDAY_ORDER`; then **unpinned** ("Any day") entries in insertion order. This is
a pure derived view (a computed signal) — the stored `entries` array preserves
insertion order.

## 6. Architecture

### 6.1 Repository — `database/weekly-menu.repo.ts`

`WeeklyMenuRepo`, all methods keyed by `householdId`. Mutations are
**read-modify-write** (like `DishTagGroupRepo.addValue`) so two members editing
concurrently don't clobber the whole array — a per-action RMW loses at most the
one racing action, not the entire menu.

- `get(householdId)` → the stored menu, or a fresh `{ householdId, entries: [] }`
  (not persisted).
- `addDish(householdId, dishId)` → RMW; **dedup**: if `dishId` already present,
  return the menu unchanged; else append `{ id: uuid, dishId, day: null }`.
  Stamps `updatedAt`. Returns the updated menu.
- `setDay(householdId, entryId, day)` → RMW; set the entry's `day` (`Weekday` or
  `null`). No-op if `entryId` missing. Returns the updated menu.
- `removeEntry(householdId, entryId)` → RMW; drop the entry. Returns the updated
  menu.
- `clear(householdId)` → set `entries: []`. Returns the updated menu.

Persisted with `kv.set(["weekly_menu", householdId], menu)`. Exported from
`database/index.ts`.

> **Research note (per CLAUDE.md):** confirm Fresh 2 handler signatures and Deno
> KV APIs via Context7 during implementation before writing the route/repo.

### 6.2 API route — `routes/api/menu/plan.ts`

`define.handlers`; every handler reads `ctx.state.householdId` and returns
**401** when absent (mirrors `routes/api/shopping/lists.ts`). All mutating
handlers return the updated `WeeklyMenuInterface` as JSON so the client can
reconcile.

- `GET` → `WeeklyMenuRepo.get(householdId)` (200).
- `POST { dishId }` → `addDish` (400 if no `dishId`; 200 with menu).
- `PATCH { entryId, day }` → `setDay` (400 if no `entryId`; `day` must be a valid
  `Weekday` or `null`; 200 with menu).
- `DELETE { entryId }` → `removeEntry`; `DELETE { clear: true }` → `clear`
  (400 if neither; 200 with menu).

### 6.3 Client service (`services/api.ts`)

```ts
api.weeklyMenu = {
  get(): Promise<WeeklyMenuInterface | null>,
  addDish(dishId: string): Promise<WeeklyMenuInterface | null>,
  setDay(entryId: string, day: Weekday | null): Promise<WeeklyMenuInterface | null>,
  removeEntry(entryId: string): Promise<WeeklyMenuInterface | null>,
  clear(): Promise<WeeklyMenuInterface | null>,
};
```

Each returns `null` on a non-ok response (same convention as `api.dishes`).

### 6.4 Hook (`hooks/useWeeklyMenu.ts`)

Mirrors `useDishes` (module `signal`s created once, wrapped by the island in
`useMemo(() => useWeeklyMenu(...), [])`). Seeded from SSR props
`initialMenu` and `initialDishes` + `initialTagGroups` (to resolve names/tags).

State / computed:
- `menu` — `signal<WeeklyMenuInterface>`.
- `plannedDishIds` — `computed<Set<string>>` of `dishId`s (drives the catalogue
  Add/Added toggle).
- `sortedEntries` — `computed<MenuEntryInterface[]>` per §5.

Actions — each **optimistic** (mutate `menu.value`), fire the scoped API call
under `beginBusy/endBusy`, **reconcile** with the returned menu, and **roll back**
to the previous value on `null`/throw (a subtle improvement over `useDishes`,
whose deletes are optimistic-only — plan membership correctness warrants it):
- `addDish(dishId)` — dedup client-side too; snackbar "Added to this week".
- `removeEntry(entryId)` / `removeDishFromPlan(dishId)` — the catalogue toggle
  uses the latter, which finds the matching entry by `dishId` in `menu.value` and
  then calls the same `entryId`-based API (there is no delete-by-`dishId`
  endpoint).
- `setDay(entryId, day)`.
- `clear()` — snackbar with **Undo**. Undo restores the pre-clear state by
  re-adding each removed dish and re-applying its weekday pin via sequential
  `addDish` + `setDay` calls (new entry ids are generated; the visible dish set
  and pins are what's restored).
- `refresh()` — reload menu (for pull-to-refresh parity with the catalogue).

Snackbars reuse whatever the islands already use for transient feedback
(`components/md3/Snackbar.tsx`); if no shared host exists yet, feedback is a
local signal in the plan island. (Implementation plan to confirm the existing
snackbar wiring.)

### 6.5 Routes & islands

**Sub-nav — `islands/menu/MenuSubNav.tsx`**
Two MD3 `Chip`s, "This week" and "Dishes"; `active` prop marks the current tab;
tap → `navigateTo("/menu")` / `navigateTo("/menu/dishes")`. A small island (needs
click handlers + `navigateTo`). Rendered at the top of both routes.

**This week — `routes/menu/index.tsx`** (was the catalogue):
- GET: `DishTagGroupRepo.ensureDefaults()`, then load in parallel
  `WeeklyMenuRepo.get(householdId)`, `DishRepo.getAll()`, `DishTagGroupRepo.getAll()`.
  401-equivalent for pages is already handled by `_middleware.ts` (redirect to
  `/login`); `householdId` is present for authenticated page loads.
- Renders `MenuSubNav active="plan"` + `islands/menu/WeeklyMenu.tsx`.

`WeeklyMenu` island (uses `useWeeklyMenu`), top → bottom:
- **Header** — "This week" + a count ("3 dishes planned" / "Nothing planned yet").
- **Empty state** — plate icon, a short warm line, and a **filled button** "Add
  dishes" → `navigateTo("/menu/dishes")`.
- **Entry list** — one card per `sortedEntries` row: a leading day chip
  (`Any` / `Mon`…) that opens the **day-picker Sheet**; the dish name; real
  **tag pills** (labels resolved from `tagGroups` via `dish.tagValueIds`); a
  trailing **remove** `IconButton` (`x`). Unknown `dishId` (deleted dish) → the
  entry is skipped/among a defensive fallback row.
- **Clear** — a text/`Pressable` action in the header row; empties the week with
  an Undo snackbar.
- **Day-picker Sheet** (`components/md3/Sheet.tsx`) — chips "Any day" + Mon–Sun;
  picking calls `setDay(entryId, day)` and closes.
- Wrapped in `PullToRefresh` (`onRefresh={refresh}`), matching the catalogue.

**Dishes — `routes/menu/dishes.tsx`** (new):
- GET: `ensureDefaults()`, then load `DishRepo.getAll()`, `DishTagGroupRepo.getAll()`,
  and `WeeklyMenuRepo.get(householdId)`.
- Renders `MenuSubNav active="dishes"` + `islands/dishes/DishCatalogue.tsx` with a
  new `initialMenu` prop.

`DishCatalogue` island — **modified** to also use `useWeeklyMenu` (seeded from
`initialMenu`):
- Each dish card gains an **Add / Added** toggle (`Button` outlined→tonal, or an
  `IconButton` `plus`→`check`) driven by `plannedDishIds`; tap →
  `addDish(d.id)` / `removeDishFromPlan(d.id)`. Existing search / tag-filter /
  navigate-to-editor behaviour is unchanged; the toggle's click `stopPropagation`s
  so it doesn't open the editor.
- The existing "Add dish" FAB (→ `/menu/new`) stays.

**Editor routes** `routes/menu/new.tsx` and `routes/menu/[id]/index.tsx` are
**unchanged**; their `backUrl` stays `/menu`. Fresh resolves the static segment
`/menu/dishes` ahead of the dynamic `/menu/[id]` (same static-vs-dynamic
precedence that already lets `/menu/new` coexist with `/menu/[id]`) — **verify
during implementation**.

Navigation: `resolveActiveTab` already prefix-matches `/menu` and `/menu/*` to the
Menu tab, so the bottom nav highlights correctly on `/menu`, `/menu/dishes`,
`/menu/new`, `/menu/[id]`.

## 7. Data flow

Route SSRs the household-scoped menu (+ dishes + tag groups) → the hook seeds its
signals → a user action mutates the signal optimistically and fires the scoped
API call → the server RMW returns the fresh menu → the hook reconciles; on
failure it rolls back and shows a snackbar. Switching sub-tabs is a full
navigation that re-SSRs from KV, so plan membership shown in the catalogue is
never stale.

## 8. File plan (for the implementation plan to expand)

- **Create:** `models/menu/{index.ts,weekly-menu.interface.ts}`; export from
  `models/index.ts`.
- **Create:** `database/weekly-menu.repo.ts`; export from `database/index.ts`.
- **Create:** `routes/api/menu/plan.ts`.
- **Create:** `hooks/useWeeklyMenu.ts` (export from `hooks/index.ts` if present).
- **Create:** `islands/menu/MenuSubNav.tsx`, `islands/menu/WeeklyMenu.tsx`.
- **Create:** `routes/menu/dishes.tsx`.
- **Modify:** `routes/menu/index.tsx` (catalogue → This-week plan view).
- **Modify:** `islands/dishes/DishCatalogue.tsx` (Add/Added toggle + `initialMenu`
  prop + sub-nav).
- **Modify:** `services/api.ts` (`api.weeklyMenu`).
- **Reuse (no change):** `components/md3/*` (Chip, Sheet, Button, IconButton,
  Icon, Card, Pressable, PullToRefresh, Snackbar), `utils/loading.ts`,
  `DishRepo`, `DishTagGroupRepo`.

## 9. Testing

Matching existing conventions (`--unstable-kv -A` for KV-backed repo tests):
- **Repo test** `database/weekly-menu.repo.test.ts` (like `dish.repo.test.ts`):
  `get` returns empty for a new household; `addDish` appends + **dedups**;
  `setDay` sets/clears a pin; `removeEntry`; `clear`; **two-household isolation**
  (a mutation on household A leaves household B empty).
- **API test** `routes/api/menu/plan.test.ts` (like `dishes.test.ts`):
  GET/POST/PATCH/DELETE happy paths returning the updated menu; **401 without a
  household**; 400 on missing `dishId`/`entryId`/action.
- **Hook test** `hooks/useWeeklyMenu.test.ts` (like `useDishes.test.ts`):
  optimistic `addDish` (+dedup), `removeDishFromPlan`, `setDay`, `clear`;
  `sortedEntries` ordering (pinned Mon→Sun then Any-day); **rollback** when the
  API returns `null`.
- **Island render tests** (preact-render-to-string, like `DishCatalogue.test.tsx`):
  `WeeklyMenu` (empty state; renders entries with tag pills + day chip; remove
  present) and the extended `DishCatalogue` (Add vs Added state); a small
  `MenuSubNav` test (active tab).
- **Gates:** `deno task check`, `deno task test`, `deno task build` all green.
- **Live verification** (mobile viewport): from `/menu/dishes`, Add a dish →
  switch to This week → it appears → pin a weekday → remove it → add two more →
  Clear → Undo. Reload to confirm persistence; confirm a second household sees an
  empty menu.

## 10. Risks & open points

- **Household scoping vs global dishes:** the weekly menu is household-scoped
  (`["weekly_menu", householdId]`) per the issue discussion, but **dishes/tags
  remain global** until #42. So a household's menu references a shared dish
  library — acceptable and consistent with today's app; noted so it isn't
  mistaken for a bug.
- **Concurrent edits:** per-action RMW avoids whole-array clobber, but a true
  simultaneous same-action race can still drop one action (last-writer-wins on
  that key). Acceptable for a family-sized household; no locking in v1.
- **Deleted dish referenced by an entry:** the plan view resolves dish names
  defensively and skips/*marks* unknown `dishId`s; no cascade cleanup when a dish
  is deleted in v1 (a future enhancement could prune entries on dish delete).
- **Seeding on read path:** `ensureDefaults()` runs in the `/menu` GET handler
  (already the case in #39); unchanged here.
- **Add-toggle affordance:** card **Button** ("Add"/"Added") vs a compact
  **IconButton** (`plus`/`check`). The prototype uses a button in the card grid
  and an icon button in list rows; the implementation picks whichever reads best
  in the current single grid layout — a low-risk visual choice, not a structural
  one.
