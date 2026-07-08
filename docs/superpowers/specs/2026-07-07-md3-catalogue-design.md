# MD3 Catalogue & Categories — Design Spec

**Date:** 2026-07-07
**Branch:** `feat/md3-catalogue` (from `develop` @ `b908fed`)
**Predecessor:** `feat/md3-shopping-spike` (MD3 foundation + Lists/List-detail), merged in PR #19.

## 1. Context & goal

The MD3 spike migrated the shopping **Lists** and **List detail** screens to a
Material Design 3 foundation (`components/md3/*`, `islands/shell/*`). The
**Catalogue** (the household's item library) and **Categories** management still
run on the old plain-Tailwind islands, are unreachable from the new 5-tab
navigation, and carry the 7 pre-existing `deno task check` type errors.

**Goal:** rebuild Catalogue + Categories management on the MD3 foundation,
faithful to the prototype (`docs/happie/project/md3-catalogue.jsx`), reusing the
existing data layer and API with **no backend changes**.

## 2. Scope

**In scope**

- Catalogue screen: browse/search the item library, add/edit/rename/move/remove
  items, grouped by category.
- Category management: create / rename / delete inline from the catalogue; a
  dedicated screen for manual **aisle ordering** (reorder).
- Wire the already-scaffolded **Lists | Catalogue** segmented on `/shopping` to
  the real catalogue.
- Retire the old Catalogue/Categories UI and delete the dead/broken legacy files
  (resolves the 7 type errors).

**Out of scope**

- Any data-model, repository, or API change (full CRUD + reorder already exist).
- The shopping List detail (Plan/Shop) — untouched, including its aisle-order
  grouping.
- Assignees / members / avatars (still deferred platform-wide).
- Adding items **to a list** — that flow already lives inside a list
  (`AddItemBody`); the catalogue is for managing the library, not building lists.

## 3. Key decisions

- **D1 — MD3 rebuild, no backend changes.** `ItemRepo` and `CategoryRepo`
  already expose full CRUD, and `CategoryRepo.reorder` does batch ordering. REST
  endpoints exist (`/api/shopping/catalogue` GET/POST/DELETE,
  `/api/shopping/categories` GET/POST/PATCH/DELETE). This is a pure UI task.

- **D2 — Architecture A: route-per-tab.** Each surface is its own
  server-rendered route that loads only its own data:
  - `/shopping` → Lists (existing).
  - `/shopping/catalogue` → Catalogue island (loads all items + categories).
  - `/shopping/categories` → Reorder screen (loads categories).
  The `Lists | Catalogue` segmented **navigates** between `/shopping` and
  `/shopping/catalogue` (full-page nav, the app's norm). `resolveActiveTab`
  already maps `/shopping/catalogue` → the Shop tab.

- **D3 — Category ordering is context-dependent.**
  - **Alphabetical** (by `label`, case-insensitive, locale-aware) in **every
    catalogue category surface**: the browse rail, category picker, and the
    move/add category chips.
  - **Aisle order** (`CategoryInterface.order`) only in the **shopping
    experience** (List-detail Shop-mode grouping — unchanged) and as the thing
    the **reorder screen** edits.
  - Consequence: the catalogue never reads/needs `order`; the reorder screen is
    the sole place `order` is set; List-detail grouping code is not modified.

- **D4 — Follow the prototype faithfully**, mapped to our id-based model
  (see §5). Categories are keyed by **id**, displayed by **label**.

- **D5 — New `useCatalogue` hook** holds `items` + `categories` signals with
  optimistic CRUD over the existing `api.items.*` / `api.categories.*`. Mirrors
  `useShoppingList`'s shape (optimistic update, `pendingCount`).

- **D6 — Cleanup resolves the 7 type errors.** Delete the old islands and legacy
  routes; the now-orphaned helpers go with them (see §7).

- **D7 — Reorder UX:** vertical list, drag to reorder with up/down buttons as an
  accessible fallback; persists via the batch reorder endpoint.

- **D8 — Testing:** `useCatalogue` unit tests + SSR render tests for the two new
  islands + live QA (mobile + desktop) before finishing.

## 4. Architecture & routes

| Route | Server loads | Renders |
|---|---|---|
| `/shopping` | lists (+counts) | existing `ShoppingLists` island; `Lists` segment active; Catalogue segment → `/shopping/catalogue` |
| `/shopping/catalogue` | all items + categories | new `Catalogue` island; Catalogue segment active; Lists segment → `/shopping` |
| `/shopping/categories` | categories | new `CategoryReorder` island |

The segmented becomes a small shared piece rendered at the top of both
`/shopping` and `/shopping/catalogue` with the appropriate active value; its
`onChange` navigates via `location.href` (consistent with `NavigationBar`).

## 5. Screens & components

### 5.1 Catalogue island (`islands/catalogue.tsx`) — per `md3-catalogue.jsx`

- **Search bar** (whole catalogue). When a query is present → **search mode**:
  matches grouped under **sticky category headers** in a 2-col grid; empty state
  offers "Add to catalogue".
- **Browse mode** (no query):
  - **Category rail** — a pinned "All" (tune icon) button that opens the
    **category picker** sheet, followed by **alphabetical** category chips. One
    category is selected at a time.
  - **Category header** — "N items in {label}" + a **⋮ menu** (rename category /
    delete category).
  - **Item grid** — the selected category's items as 2-column tiles (name +
    edit affordance); tapping a tile opens the **edit-item** sheet. A dashed
    **"Add item"** ghost tile opens the **add-to-catalogue** sheet.
  - **Uncategorized** items (no `categoryId`) appear under an "Uncategorized"
    pseudo-category (shown only when such items exist; not selectable as a real
    category for renaming/deleting).
- **Top-app-bar overflow** (via `utils/app-bar.ts`, like List detail): a
  "Reorder categories (aisle order)" action → navigates to `/shopping/categories`.

**Sheets** (reuse the `Sheet` primitive):

- **Edit item** (`CatalogueItemBody`): rename (with duplicate detection by name,
  case-insensitive) · move category (alphabetical chips) · "Remove from
  catalogue".
- **Category picker** (`CatPickerBody`): pinned "New category" (inline create) ·
  search field when >6 categories · `ListItem` per category with item count and
  a check on the selected one.
- **Add-to-catalogue** (`CatalogueAddBody`): choose/create a category, then add
  items rapid-fire (Enter keeps adding); shows "added just now" chips; duplicate
  detection.

### 5.2 Category reorder island (`islands/category-reorder.tsx`)

- Vertical list of categories in current aisle order.
- Drag-to-reorder (pointer/touch) with up/down buttons as a keyboard/a11y
  fallback; persists the new order via the batch reorder endpoint
  (`api.categories` PATCH with `[{id, order}]`).
- Rename/delete are **not** duplicated here (they live in the catalogue); this
  screen is focused on ordering.

## 6. Data flow

- `useCatalogue(initialItems, initialCategories)` exposes:
  - `items`, `categories` signals; derived `byCategory` / alphabetical
    `sortedCategories`; `itemNames` set for duplicate checks.
  - `addItem(name, categoryId)`, `renameItem(id, name)`, `moveItem(id,
    categoryId)`, `removeItem(id)`.
  - `createCategory(label)`, `renameCategory(id, label)`, `deleteCategory(id)`.
  - All optimistic over the existing `api` client; `pendingCount` for in-flight
    state. Category reorder is handled by the reorder island directly.
- **No new endpoints, KV keys, DTOs, or model fields.**

## 7. Cleanup (files to delete / edit)

Verified by reference search — each is used only by files being replaced:

**Delete:**
- `islands/item-catalog.tsx`, `islands/category-management.tsx`
- `routes/shopping/catalogue/new.tsx`, `routes/shopping/catalogue/overview.tsx`,
  `routes/shopping/catalogue/[id]/index.tsx`,
  `routes/shopping/catalogue/[id]/edit.tsx` (legacy/broken; superseded)
- `components/list.tsx`, `components/Button.tsx` (old — the MD3 `Button` lives at
  `components/md3/Button.tsx`)
- `hooks/useCollection.ts`, `hooks/useCategoryManagement.ts`
- Any tests bound to the above (verify during planning).

**Edit:**
- `routes/shopping/catalogue/index.tsx` → render the new `Catalogue` island.
- `routes/shopping/categories/index.tsx` → render the new `CategoryReorder`
  island.
- `hooks/index.ts` → drop the `useCategoryManagement` re-export.

This removes the old UI and clears all 7 pre-existing `deno task check` errors.

## 8. Error handling & edge cases

- **Duplicate item names:** blocked in the add/edit sheets (case-insensitive
  match across the whole catalogue), with an inline error message.
- **Deleting a category with items:** no cascade — its items become
  uncategorized (matches current behavior). The delete confirmation states how
  many items will be affected.
- **Optimistic writes:** update the signal first, call the API, keep a
  `pendingCount`; mirror `useShoppingList`'s best-effort approach. Surface a
  snackbar on failure where practical.
- **Empty states:** no categories yet (prompt to create one), empty category
  (prompt to add first item), no search matches (offer add-to-catalogue).

## 9. Testing

- **`useCatalogue`** unit tests: optimistic add/rename/move/remove item;
  create/rename/delete category; duplicate-name guard; alphabetical sort.
- **SSR render tests** for `Catalogue` and `CategoryReorder` islands (render
  without hydration; key elements present).
- **Gates:** `deno test`, `deno task build`, `deno fmt --check`, `deno lint`,
  and — now that the WIP files are gone — a **green whole-project `deno check`**.
- **Live QA:** create/rename/move/delete items; category create/rename/delete;
  reorder → confirm Shop-mode aisle grouping reflects the new order; mobile +
  desktop; zero console errors.

## 10. Success criteria

- `Lists | Catalogue` segmented switches between `/shopping` and
  `/shopping/catalogue`; catalogue is fully usable.
- Category selection is alphabetical everywhere in the catalogue; Shop-mode
  grouping still follows manual aisle order, now editable via the reorder screen.
- Old Catalogue/Categories UI removed; `deno task check` is **green** for the
  first time on this line of work.
- No data-model/API changes.
