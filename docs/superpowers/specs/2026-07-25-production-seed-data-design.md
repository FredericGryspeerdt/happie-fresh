# Production-like Seed Data for Development — Design

**Issue:** [#21](https://github.com/FredericGryspeerdt/happie-fresh/issues/21) — Add production-like seed data for development testing
**Date:** 2026-07-25
**Status:** Approved

## Problem

The development environment has only a minimal seed (`scripts/seed.ts`): it
creates a single demo user from `SEED_USERNAME`/`SEED_PASSWORD`, which
auto-provisions one household and one empty "Shopping List". There are no
categories, no catalogue items, and no populated lists. This makes it hard to
develop and test features that depend on realistic data patterns (grouping by
category, long lists, mixed checked states, notes, quantities, edge cases).

## Goals

- A curated, deterministic, production-like dataset for local development.
- Exercises realistic scenarios and deliberate edge cases.
- Easily reproducible and updateable.
- Documented in the development setup.
- Never runs against production.

## Non-goals

- Shared multi-member households (parents + kids in one household). The current
  data model creates one household per user; this seed keeps that model. A
  shared-household experience is a separate feature.
- Randomized / generated data. Content is hand-authored for determinism.
- Changing production behavior of `UserRepo.create` or registration.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Data shape | A few independent demo users, each with their own household + populated lists. `categories` and `items` (catalogue) are global and seeded once. |
| Re-run behavior | **Reset then reseed** — wipe seed-owned collections and rebuild every run. Deterministic. Dev-guarded. |
| Content source | **Hand-authored fixtures** — typed TypeScript constants. |
| Language | English (matches the app UI). |
| Volume | Moderate — ~3 users, ~8 categories, ~55 catalogue items, 1–3 lists per user. |

## Data model recap (existing)

Deno KV keys:

- `["users", id]` and `["users_by_username", username]` →
  `{ id, username, passwordHash, householdId }`
- `["households", id]` → `{ id, name }`
- `["categories", id]` → `{ id, label, order?, createdAt?, createdBy? }` (global)
- `["items", id]` → `{ id, name, categoryId? }` (global catalogue)
- `["shopping_lists", householdId, id]` →
  `{ id, householdId, name, createdBy, createdAt }`
- `["shopping_list_items", listId, id]` →
  `{ id, listId, itemId, quantity, note?, checked }`
- `["sessions", id]` → session records

Relationships: user → household (1:1 today); household → many lists; list → many
list-items; list-item → catalogue item; catalogue item → category.

## Architecture

### File layout

```
scripts/
  seed.ts              # thin entrypoint (deno task db:seed): dev guard, open KV, runSeed, close
  seed/
    fixtures.ts        # hand-authored data + fixture types (slug-based)
    runner.ts          # resetDatabase(kv) + runSeed(kv) — pure orchestration, testable
    runner.test.ts     # in-memory KV: assert structure + reproducibility
```

`deno task db:seed` continues to point at `scripts/seed.ts`.

### Fixture data model (slug-based references)

Fixtures cannot hardcode UUIDs (generated at insert time), so entities reference
one another by stable **slugs** that the orchestrator resolves to generated IDs.

```ts
export interface SeedCategory { slug: string; label: string; order: number }

export interface SeedItem { slug: string; name: string; categorySlug?: string }

export interface SeedListItem {
  itemSlug: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

export interface SeedList { name: string; items: SeedListItem[] }

export interface SeedUser {
  username: string;
  password: string; // plaintext dev password; hashed at insert
  lists: SeedList[];
}
```

`fixtures.ts` exports `categories: SeedCategory[]`, `catalogue: SeedItem[]`, and
`users: SeedUser[]`.

### Orchestration flow — `runSeed(kv: Deno.Kv)`

1. **Reset** (`resetDatabase(kv)`): delete all entries under prefixes `users`,
   `users_by_username`, `households`, `categories`, `items`, `shopping_lists`,
   `shopping_list_items`, `sessions`.
2. Insert categories via `CategoryRepo.create`; build `categorySlug → id` map.
3. Insert catalogue via `ItemRepo.create` (resolving `categoryId` from the
   map); build `itemSlug → id` map. Items with no `categorySlug` are inserted
   uncategorized.
4. For each user:
   - Create the household via `HouseholdRepo.create` (name derived, e.g.
     `${username}'s household`).
   - Write the user record directly: `["users", id]` + `["users_by_username",
     username]` in an atomic op, with `passwordHash` from `hashPassword`.
     Rationale: `UserRepo.create` force-creates an empty "Shopping List" and its
     own household, which conflicts with fixture-defined lists. Direct KV writes
     in scripts match the existing convention (`migrate.ts`, `db-viewer.ts`,
     `seed.ts`).
   - For each list: `ShoppingListRepo.create`, then each list item via
     `ShoppingListItemRepo.add` followed by `.update` for `quantity`/`note`/
     `checked` (resolving `itemId` from the catalogue map).

`runSeed` is pure with respect to KV (takes the `kv` instance / uses the
singleton) and performs no environment guarding, so tests can call it directly.

### Credentials

- Primary demo user: `SEED_USERNAME` / `SEED_PASSWORD` from env if both set
  (preserves current behavior); otherwise a documented default (e.g.
  `demo` / `password`).
- Other demo users: fixed usernames with a shared, documented dev password.

The current `scripts/seed.ts` uses non-null assertions on the env vars; the new
entrypoint makes them optional with fallbacks.

### Dev-only guard

`scripts/seed.ts` refuses to run when `DENO_DEPLOYMENT_ID` is set (Deno Deploy),
printing a clear message and exiting non-zero. The guard lives in the
entrypoint, not in `runSeed`, so tests remain unaffected.

## Content plan (moderate)

**Categories (~8, ordered):** Produce, Dairy & Eggs, Bakery, Meat & Fish,
Pantry, Frozen, Beverages, Household.

**Catalogue (~55 items)** spread across the categories, with a few intentionally
uncategorized.

**Users (3), each own household:**

- **Primary** (`SEED_USERNAME` or `demo`): lists "Weekly Groceries" (realistic
  mixed list), "Weekend BBQ" (mostly unchecked), "Pantry Restock" (fully
  checked — everything bought).
- **User 2**: "Groceries" (mixed), "Party Supplies" (empty list).
- **User 3**: "Big Weekly Shop" (~15 items across all categories — long-list /
  grouping scenario).

### Edge cases deliberately placed

- Fully-checked list ("everything bought").
- Empty list (created, no items).
- Long list (~15 items, spans all categories) for grouping/scroll.
- Very long item note.
- Very long list name (rename edge).
- High quantity (e.g. 24).
- Emoji / unicode in a note.
- Uncategorized catalogue item on a list.
- Same catalogue item on multiple users' lists.
- Mixed checked/unchecked within a single list.

## Documentation

Replace the bare Fresh stub `README.md` (or add a dedicated section) with a
"Development seed data" section covering:

- `deno task db:seed` — what it creates.
- Reset-then-reseed behavior (destructive, dev-only).
- Demo credentials (primary + others).
- The `DENO_DEPLOYMENT_ID` production guard.

## Testing

`scripts/seed/runner.test.ts`, following repo test convention
(`Deno.env.set("KV_PATH", ":memory:")` at module load, `sanitizeResources:
false`):

- Category count equals fixtures length and categories are ordered.
- Item count equals fixtures length; every item's `categoryId` (when set)
  resolves to an existing category.
- User count equals fixtures length; each user has a household and a
  `users_by_username` index entry.
- Each user's lists match fixtures; every list-item references an existing
  catalogue item; `checked`/`quantity`/`note` are preserved.
- The fully-checked list and the empty list exist with expected states.
- **Reproducibility:** running `runSeed` twice yields identical counts (reset
  works).

`docs/` is excluded from `deno fmt`/`lint`/`check`, so this spec does not affect
`deno task check`.

## Out of scope / future

- Shared multi-member households.
- A randomized/high-volume generator mode.
- Seeding sessions for auto-login.
