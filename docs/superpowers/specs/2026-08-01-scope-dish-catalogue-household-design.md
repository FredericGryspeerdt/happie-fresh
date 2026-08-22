# Scope dish catalogue & tag groups to household

**Issue:** [#42](https://github.com/FredericGryspeerdt/happie-fresh/issues/42)
— deferred from #39 (Dish Catalogue CRUD), part of #14 (Dish Management &
Meal Suggestion).

**Date:** 2026-08-01

## Problem

The dish catalogue collections (`["dishes", id]`, `["dish_tag_groups", id]`)
and the shopping catalogue collections (`["items", id]`, `["categories", id]`)
are **global** KV collections. Shopping *lists* are already household-scoped
(`ShoppingListRepo` keys include `householdId`), so the catalogue is the odd one
out. As multi-household usage grows, every household sees the same shared
libraries and can mutate each other's data.

This spec scopes all four collections per household so each household has its own
isolated catalogue, categories, dishes, and tag groups.

## Decisions (from brainstorming)

1. **Scope all four collections together** (`dishes`, `dish_tag_groups`,
   `items`, `categories`). Dishes reference catalogue items, so they must move
   together to stay consistent.
2. **Migration assigns existing global data to one primary household.** Other
   households start empty and lazily seed default tag groups.
3. **Repo API shape (A):** `householdId` as the first argument of each repo
   method — matches the existing `ShoppingListRepo` / `ShoppingListItemRepo`
   pattern (all repos stay static).

## KV key change

All four collections move from `["<collection>", id]` to
`["<collection>", householdId, id]`, mirroring
`["shopping_lists", householdId, id]`.

`householdId` flows from `_middleware.ts` → `ctx.state.householdId` (already
populated from the session user's `householdId`).

## Repository changes

Each method gains `householdId` as its first parameter and scopes its key /
`list` prefix accordingly.

| Repo | Methods |
|---|---|
| `DishRepo` | `create`, `getAll`, `getById`, `update`, `delete` |
| `DishTagGroupRepo` | `getAll`, `getById`, `ensureDefaults`, `addValue` |
| `ItemRepo` | `create`, `readAll`, `getById`, `update`, `delete` |
| `CategoryRepo` | `create`, `getAll`, `getById`, `update`, `delete`, `reorder` |

Notes:

- `DishInterface.ingredientIds` (→ item ids) and `tagValueIds` (→ tag-value
  ids) keep referencing entities **within the same household**. No cross-
  household references exist, so no model/schema change is required.
- `CategoryRepo.create` computes `maxOrder` from `getAll()` — it must pass
  `householdId` through so ordering is per-household.
- `CategoryRepo.reorder` and `DishTagGroupRepo.addValue` fetch-then-write via
  `getById`; those internal calls thread `householdId` too.

## Seeding per household

- `DishTagGroupRepo.ensureDefaults(householdId)` stays **lazy**
  (seed-when-empty), unchanged behavior, just scoped to
  `["dish_tag_groups", householdId]`. Existing callers (menu SSR pages, the
  `tag-groups` GET handler) already invoke it; they pass `householdId`.
- `scripts/seed/runner.ts`: give **each fixture household its own copy** of the
  fixture categories + catalogue items. Build a **per-household**
  `itemIdBySlug` / `categoryIdBySlug` map so each household's lists resolve
  against its own items. Add `["dishes"]` and `["dish_tag_groups"]` to
  `SEED_PREFIXES` so reseeds wipe them cleanly.

## API handlers + SSR pages

Derive `householdId` from `ctx.state`; return **401** when absent — no
cross-household leakage.

**API handlers (`routes/api/…`):**

- `menu/dishes.ts` and `menu/tag-groups.ts`: convert from `Context<unknown>` to
  the `define.handlers` pattern (like `shopping/lists.ts`) so they get typed
  `ctx.state.householdId`. Return 401 if missing.
- `shopping/catalogue.ts` and `shopping/categories.ts`: read `householdId` from
  state (they already read `userId`). Return 401 if missing.

**SSR loaders (`routes/…`)** pass `ctx.state.householdId` into repo calls, and
redirect/401 when missing (consistent with how `shopping/index.tsx` already
guards):

- `menu/index.tsx`, `menu/[id]/index.tsx`, `menu/new.tsx`
- `shopping/catalogue/index.tsx`, `shopping/categories/index.tsx`
- `shopping/[id]/index.tsx`, `shopping/[id]/add.tsx` (the `ItemRepo.readAll` /
  `CategoryRepo.getAll` calls)

## Migration (`scripts/migrate.ts`)

Add an **idempotent** step that moves each global catalogue entry under the
primary household.

**Primary household selection:**

- Use the household of the user named by the `PRIMARY_USERNAME` env var.
- If `PRIMARY_USERNAME` is unset **and** exactly one household exists, use that
  one.
- Otherwise (unset + multiple households) **error out** — never guess which
  household should own the shared library.

**Per collection** (`items`, `categories`, `dishes`, `dish_tag_groups`):

- Iterate entries under the bare collection prefix.
- A **length-2** key (`[collection, id]`) is global → rewrite the value to
  `[collection, householdId, id]` and delete the old length-2 key.
- A **length-3** key (`[collection, householdId, id]`) is already scoped → skip.

Skipping length-3 keys makes reruns safe (idempotent). Log per-collection
counts, matching the existing migration's logging style.

## Testing

- Update `database/dish.repo.test.ts` and `database/dish-tag-group.repo.test.ts`
  to pass `householdId`; add **cross-household isolation** assertions (household
  A cannot see household B's data).
- Add scoping tests for `ItemRepo` and `CategoryRepo` (none exist today),
  including isolation.
- Update `scripts/seed/runner.test.ts` for the per-household catalogue.
- `deno task check` and `deno task test` must be green before opening the PR.

## Out of scope

- No UI/UX changes — the pages already exist; only their loaders change.
- No household management features (creation/switching stays as-is).
- No change to how `shopping_list_items` are keyed (list-scoped today; the list
  already belongs to a household, so item-id references resolve within it).

## Acceptance criteria (from the issue)

- [x] Dishes and dish tag groups stored/queried per household.
- [x] Catalogue items and categories scoped per household (decision: scope them,
      not split out).
- [x] API handlers derive `householdId` from session state; no cross-household
      leakage.
- [x] Existing data migrated without loss (to the primary household).
- [x] Default tag groups seeded per household.
