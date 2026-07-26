# Dish Catalogue Management (CRUD) — Design

**Date:** 2026-07-26
**Status:** Draft (awaiting review)
**Issue:** #39 (Add Dish Catalogue Management — CRUD Operations)
**Module:** Menu planner (`/menu`) — currently a `ComingSoon` placeholder
**Follow-ups spun out:** #42 (household scoping), #43 (full tag-group management)

---

## 1. Problem & context

Issue #39 asks for a central **catalogue of dishes** with full CRUD, as the
foundation for the meal-suggestion system in #14. A dish has:

- **Name**
- **Ingredients** — items from the shopping catalogue, so a future meal plan can
  push a dish's ingredients onto a shopping list.
- **Tags** — characteristics grouped by dimension for organising and filtering:
  Type (Vegetarian/Fish/Meat), Meal (Main dish/Breakfast/Lunch/Side dish),
  Side type (Rice/Potatoes/Pasta).

The **Menu** tab already exists in the bottom navigation (`config/navigation.ts`,
id `menu`, route `/menu`) and renders `ComingSoon`. #14 ("Add Dish Management and
Meal Suggestion Feature") is the parent; this feature builds the dish-management
half. The suggestion engine stays in #14.

The shopping **Catalogue** (`islands/catalogue.tsx`, `hooks/useCatalogue.ts`,
`ItemRepo`, `CategoryRepo`, `routes/api/shopping/catalogue.ts`) is a close analog
and the template for this feature's stack.

## 2. Goals / non-goals

**Goals**
- Full CRUD for dishes: create, list, view details, update, delete.
- Structured **tags** modelled as named groups (dimensions) with values; a dish
  selects any number of values across groups.
- **Ingredients** as references to existing catalogue items; add a brand-new
  catalogue item inline while editing a dish.
- **Filter** the dish list by name (search) and by tag values.
- Seed three default tag groups on first use; allow adding a **value** to an
  existing group inline.
- Replace the `/menu` `ComingSoon` placeholder with the dish catalogue.
- Reuse existing conventions: repos, `services/api.ts`, MD3 components, the
  optimistic-signals hook pattern, `beginBusy/endBusy` loading, `appBarAction`.

**Non-goals (v1)**
- Meal suggestion / weekly planning (#14).
- Per-household scoping of dishes/tags — stored globally like the existing
  catalogue (`items`/`categories`). Deferred to **#42**.
- Creating/renaming/deleting whole tag **groups**, and renaming/deleting tag
  **values**. v1 ships seeded groups + inline add-value only. Deferred to **#43**.
- Per-ingredient **quantities/amounts** — ingredients are item references only.
- Adding a dish's ingredients to a shopping list (a #14 concern; the data model
  makes it possible).
- Dish images, ratings, notes/recipe steps.

## 3. Product alignment

Happie is a household manager; the shopping list is the first module and the
Menu planner is the next. The dish catalogue is a **shared household library**
(like the shopping catalogue) that each member contributes to. UX stays warm and
simple: pick from chips, tap to add, no clinical forms. Mobile-first — a
full-screen editor keeps the richer dish form comfortable on a phone.

## 4. Data model

New model directory `models/dish/`, exported from `models/index.ts`.

```ts
// models/dish/dish.interface.ts
export interface DishInterface {
  id: string;
  name: string;
  ingredientIds: string[]; // → catalogue Item ids (["items", id])
  tagValueIds: string[];   // → DishTagValue ids, flat across all groups
  createdAt?: string;
  createdBy?: string;
}
export type CreateDishDto = Omit<DishInterface, "id">;
export type UpdateDishDto =
  & Pick<DishInterface, "id">
  & Partial<Omit<DishInterface, "id">>;

// models/dish/dish-tag-group.interface.ts
export interface DishTagValueInterface {
  id: string;
  label: string;
}
export interface DishTagGroupInterface {
  id: string;
  label: string;                    // "Type", "Meal", "Side type"
  order?: number;
  values: DishTagValueInterface[];  // values embedded in the group
}
```

**Rationale**
- A dish stores a **flat** `tagValueIds`; a value's group is derived by looking
  it up in the groups collection. Embedding values inside the group keeps a group
  to one KV entry (groups are small, read together).
- `ingredientIds` reference catalogue `Item`s — the same entities shopping lists
  reference — which is exactly what a later "add dish to list" flow needs.
- Field/DTO shape mirrors `ItemInterface`/`CategoryInterface` for consistency.

**KV keys** (global, matching the existing catalogue; see #42):
- `["dishes", id]`
- `["dish_tag_groups", id]`

## 5. Default tag groups & seeding

`DishTagGroupRepo.ensureDefaults()` creates the following if the collection is
empty (idempotent — no-op when any group exists). Called by the `/menu` GET
handler before reading, so the feature is useful immediately without a re-seed.

| Group (order) | Values |
| --- | --- |
| Type (0) | Vegetarian, Fish, Meat |
| Meal (1) | Main dish, Breakfast, Lunch, Side dish |
| Side type (2) | Rice, Potatoes, Pasta |

Value and group ids are `crypto.randomUUID()`. Labels are the seed defaults;
adding a value is the only mutation in v1 (§7). Full management → #43.

## 6. Architecture

### 6.1 Repositories

`database/dish.repo.ts` — mirrors `ItemRepo`/`CategoryRepo`:
- `create(dish: CreateDishDto)` → assigns id + `createdAt`, atomic set.
- `readAll()` → all dishes.
- `getById(id)`.
- `update(id, patch)` → `mergeDefinedPatch(existing, patch)` (partial-safe, like
  `CategoryRepo.update`), returns updated or `null` if missing.
- `delete(id)`.

`database/dish-tag-group.repo.ts`:
- `ensureDefaults()` → seed if empty (idempotent).
- `getAll()` → groups sorted by `order`.
- `getById(id)`.
- `addValue(groupId, label)` → append a `{ id, label }` value to the group,
  return the created value (used by inline "+ New").

Both exported from `database/index.ts`.

> **Research note (per CLAUDE.md):** confirm Fresh 2 handler signatures and Deno
> KV atomic APIs via Context7 during implementation before writing route/repos.

### 6.2 API routes (mirror `routes/api/shopping/catalogue.ts`)

- `routes/api/menu/dishes.ts`
  - `GET` → all dishes (JSON).
  - `POST` → create when no `id`; update when `id` present (404 if missing).
    Returns the saved dish. (Same create-or-update-on-POST shape as
    `catalogue.ts`.)
  - `DELETE` → `{ id }` body → delete (400 if no id, 204 on success).
- `routes/api/menu/tag-groups.ts`
  - `GET` → all groups (after `ensureDefaults`).
  - `POST` → `{ groupId, label }` → add a value, return the created value (201).

Handlers derive nothing household-specific in v1 (global store; see #42). Auth is
already enforced by `_middleware.ts` (401 for `/api/*` when unauthenticated).

### 6.3 Client service (`services/api.ts`)

Add, mirroring `api.items`:

```ts
api.dishes = {
  getAll(): Promise<DishInterface[]>,
  create(dish: CreateDishDto): Promise<DishInterface | null>,
  update(id, patch: Partial<DishInterface>): Promise<DishInterface | null>,
  delete(id): Promise<void>,
};
api.dishTagGroups = {
  getAll(): Promise<DishTagGroupInterface[]>,
  addValue(groupId, label): Promise<DishTagValueInterface | null>,
};
```

### 6.4 Hook (`hooks/useDishes.ts`) — list surface only

Mirrors `useCatalogue`: `signal`s for `dishes` and `tagGroups`, computed helpers,
`beginBusy/endBusy` on each in-flight write.

- `filtered` (computed) — dishes matching the name query **and** the selected
  tag-value filters, using faceted semantics: **OR within a group, AND across
  groups** (e.g. selecting Type=Vegetarian + Meal=Main dish → vegetarian mains;
  selecting Type=Vegetarian + Type=Fish → vegetarian *or* fish). Implemented by
  grouping selected value ids by their group; a dish matches when, for every
  group that has any selected value, the dish holds at least one of them.
- `removeDish(id)` — optimistic remove + `api.dishes.delete`.
- `refresh()` — reload dishes + tag groups (for pull-to-refresh).
- Selection/query state for the filter UI (name query signal, selected
  tag-value id set).

The **editor** does not use this hook; it owns local form state and SSR-loads its
own data per route (roomier, no shared in-memory state between islands — same
approach as `add-items.tsx`). Create/edit/delete then navigate back to `/menu`,
which re-renders fresh from the server.

### 6.5 Routes & islands

**List — `routes/menu/index.tsx`** (replaces `ComingSoon`):
- `define.handlers` GET: `DishTagGroupRepo.ensureDefaults()`, then load
  `dishes`, `tagGroups`, and catalogue `items` (to resolve ingredient names for
  display). `page({ dishes, tagGroups, items })`.
- Renders `islands/dishes/DishCatalogue.tsx`.

`DishCatalogue` island (uses `useDishes`), top → bottom:
- **Search field** (filter by name) — same rounded search input as the catalogue.
- **Tag filter rail** — chips grouped by dimension; tapping toggles a value
  filter (multi-select). A "clear filters" affordance when any is active.
- **Dish grid** — tiles showing the dish name (and a small ingredient/tag hint).
  Tap a tile → `/menu/{id}`. Empty state ("No dishes yet") + an add affordance.
- **FAB** (`islands/shell/Fab.tsx` / `FabMenu` pattern) → navigate to
  `/menu/new`.
- Wrapped in `PullToRefresh` (`onRefresh={refresh}`), like the catalogue.

**Editor — `routes/menu/new.tsx` and `routes/menu/[id]/index.tsx`**:
- GET sets `ctx.state.appBar = { mode: "detail", title, backUrl: "/menu" }`
  (title "New dish" / the dish name). Loads `tagGroups` + catalogue `items`; the
  `[id]` route also loads the dish (404 if missing).
- Renders `islands/dishes/DishEditor.tsx` with the dish (or blank), tag groups,
  and catalogue items.

`DishEditor` island (local `useSignal` form state):
- **Name** field.
- **Ingredients** — chips of chosen catalogue items + "Add ingredient" opens a
  searchable catalogue picker (reuse/adapt `CategoryPickerList`/search patterns).
  A no-match "Create '‹query›'" affordance creates a catalogue item via
  `api.items.create` and selects it. Selected ingredients removable via chip.
- **Tags** — one chip group per dimension (multi-select values); a "+ New" chip
  per group adds a value inline via `api.dishTagGroups.addValue` and selects it.
- **Save** — a trailing app-bar action set via the module-scope `appBarAction`
  signal (set on mount, cleared on unmount, as documented in `utils/app-bar.ts`);
  POSTs create/update, then `navigateTo("/menu")`.
- **Delete** (edit route only) — an error-styled button; deletes then returns to
  `/menu`.

Navigation: `resolveActiveTab` already maps `/menu` and `/menu/*` to the Menu
tab (prefix match), so the bottom nav highlights correctly on all sub-routes.

## 7. Tag management scope (v1 vs #43)

- **v1:** seeded groups (§5) + add a **value** to an existing group inline from
  the editor.
- **#43 (deferred):** create/rename/delete tag **groups**; rename/delete tag
  **values**; reference cleanup on delete (strip removed `tagValueId`s from
  dishes, warn about affected dishes — mirroring the catalogue's "N items become
  uncategorized" pattern).

## 8. File plan (for the implementation plan to expand)

- **Create:** `models/dish/{index.ts,dish.interface.ts,dish-tag-group.interface.ts}`;
  export from `models/index.ts`.
- **Create:** `database/dish.repo.ts`, `database/dish-tag-group.repo.ts`; export
  from `database/index.ts`.
- **Create:** `routes/api/menu/dishes.ts`, `routes/api/menu/tag-groups.ts`.
- **Create:** `hooks/useDishes.ts` (export from `hooks/index.ts` if present).
- **Create:** `islands/dishes/DishCatalogue.tsx`, `islands/dishes/DishEditor.tsx`.
- **Create:** `routes/menu/new.tsx`, `routes/menu/[id]/index.tsx`.
- **Modify:** `routes/menu/index.tsx` (replace `ComingSoon` with the list).
- **Modify:** `services/api.ts` (`api.dishes`, `api.dishTagGroups`).
- **Reuse (no change):** `components/md3/*` (Chip, Sheet, Segmented, Button,
  IconButton, Icon, ListItem, Pressable, FabMenu, PullToRefresh),
  `utils/app-bar.ts`, `utils/loading.ts`, `ItemRepo`, `mergeDefinedPatch`.

## 9. Testing

Matching existing conventions (`--unstable-kv -A` for KV-backed repo tests):
- **Repo tests** (like `shopping-list-item.repo.test.ts`): dish CRUD incl.
  partial `update`; tag-group `ensureDefaults` **idempotency** + `addValue`.
- **Hook test** (like `useCatalogue.test.ts`): `useDishes` name+tag filtering
  (OR-within-group / AND-across-groups semantics) and optimistic `removeDish`.
- **Island render tests** (preact-render-to-string, like `catalogue.test.tsx`):
  `DishCatalogue` (renders dishes, filter chips, empty state) and `DishEditor`
  (renders name/ingredients/tags, and delete only on the edit route).
- **Gates:** `deno task check`, `deno task test`, `deno task build` all green.
- **Live verification** (mobile viewport): create a dish with ingredients + tags
  → appears on `/menu` → filter by name and by tag → open → edit → delete.

## 10. Risks & open points

- **Seeding on read path:** `ensureDefaults()` runs in the `/menu` GET handler.
  It's idempotent and cheap, but a first-visit write on a GET is a mild wart;
  acceptable for a single seed. Alternative (add to `db:seed`) rejected to keep
  the feature self-contained.
- **Ingredient/tag reference integrity:** deleting a catalogue item leaves
  dangling `ingredientId`s on dishes (the list resolves names defensively and
  skips unknown ids). Full cleanup is out of scope; note for #43/#42.
- **Global storage:** intentional for consistency with the existing catalogue;
  per-household isolation tracked in #42.
- **Editor Save affordance:** app-bar trailing action vs an in-form button —
  design uses the app-bar action (matches list-detail "options" precedent); a
  bottom Save button is an easy alternative if it reads better on device.
