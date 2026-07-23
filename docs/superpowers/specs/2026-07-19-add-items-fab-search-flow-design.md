# Add-Items FAB + Full-Screen Search Flow — Design

**Date:** 2026-07-19
**Branch base:** builds on `feat/fullscreen-add-items` (PR #26 — the dedicated
`/shopping/[id]/add` route + fixed-height sheet). This iteration reworks the
*entry* into that page and the page itself.
**Module:** Shopping list (first module of the Happie household platform).

## Goal

Replace the list page's "dummy search bar that opens a bottom sheet" with a
Floating Action Button that opens a dedicated, full-screen **search-to-add**
page, and make that page a fast loop: **search → add → tweak quantity/note →
repeat → back**, without a round-trip to the list.

## Background — current state

- **List page** (`islands/items.tsx`, Plan mode): a `SearchBar` that, on tap,
  opens a quick-add bottom `Sheet`. The sheet has its own search input, live
  results, and hand-off controls to the full-screen page. There is also an
  **item-editor sheet** (quantity, category, note, remove) and a
  **list-options sheet** (rename, share, clear, delete).
- **Add page** (`routes/shopping/[id]/add.tsx` + `islands/add-items.tsx`):
  reached from the quick-add sheet. Shell renders a `detail` top app bar
  ("Add items" + back) and the app-wide bottom `NavigationBar`. Idle state
  shows **category filter chips**; typing shows a create-on-no-match card +
  substring results.
- **Shell** (`islands/shell/AppChrome.tsx`): renders `TopAppBar` (detail bar
  when `ctx.state.appBar` is set, else a section-title bar) and **always**
  renders `NavigationBar`. `ctx.state.appBar` is typed `AppBarDetail`
  (`{ mode: "detail"; title; backUrl }`) in `utils/define.ts` — the `mode`
  discriminator was built to extend.
- **Data:** `useShoppingList(listId, catalog, shoppingList, categories)` already
  owns all list state and mutations (`addToList` → new list-item id,
  `addToCatalog(name, categoryId?)` → creates catalogue item **and** adds it,
  `updateListItem`, `flushListItem`, `removeListItem`, `getItemName`,
  `listItemsMap`, `list`, `groupedList`). **No new data model or API is
  needed.**

## User journey

1. On a list (Plan mode), tap the **"Add items"** FAB → full-screen add page.
2. Type into the search bar → **results appear in a list below it**.
3. Tap a result → it's **added** (quantity 1), optimistically. The row flips to
   an "added" state.
4. Bump **quantity** with the inline stepper on the added row (instant, no
   sheet). Or tap the added row → a compact **editor sheet** (quantity + note)
   → type a note → **Done**.
5. Everything added this visit collects in a pinned **"Added (N)"** section,
   reachable to re-tweak after you've searched for something else.
6. No match? A **"Create '<query>'"** card lets you pick a category and add a
   brand-new catalogue item.
7. Tap **back** (in the search bar) → return to the list. Nothing to save —
   adds and edits were already committed.

## Design

### 1. Entry: FAB on the list, retire the quick-add sheet

`islands/items.tsx`:

- **Remove** the `SearchBar` (which opened the quick-add sheet) and the entire
  **quick-add `Sheet`** with its machinery: the in-sheet `useSearchBox` usage
  (`query`, `results`, `inputRef`, `reset`, `filterFn`), `handleAddToList`, the
  autofocus effect keyed on `addOpen`, `openAddPage`, and the `addOpen` signal.
  Drop now-unused imports (`SearchBar`, `CatalogueAddRow`, `useSearchBox`) and
  hook returns used only by the sheet (`addToList`, `listItemsMap`). Keep
  `items`, `categories`, `getItemName` — still used by the item-editor sheet.
- The **item-editor sheet** and **list-options sheet** are untouched.
- **Add** an extended FAB, reusing `islands/shell/Fab.tsx`, shown **only in Plan
  mode**, placed exactly like the lists index
  (`islands/shopping-lists.tsx`): a wrapper `fixed right-4 z-30` at
  `bottom: calc(96px + env(safe-area-inset-bottom))`, containing
  `<Fab icon="plus" label="Add items" aria-label="Add items"
  onClick={() => globalThis.location.href = ` + "`/shopping/${listId}/add`" + `} />`.
- **Empty-state copy:** "Tap the search bar to add items." → "Tap **Add items**
  to get started."

### 2. Full-screen search surface — shell `{ mode: "none" }`

The search query lives in the add island, so the *island* owns the top bar and
the shell renders no chrome on this route.

- `utils/define.ts`: extend the union.
  ```ts
  export interface AppBarDetail { mode: "detail"; title: string; backUrl: string }
  export interface AppBarNone { mode: "none" } // route owns the full screen
  export type AppBar = AppBarDetail | AppBarNone;
  // StateInterface.appBar?: AppBar
  ```
- `routes/_app.tsx`: pass the discriminated `state.appBar` through to
  `AppChrome` (instead of the flattened `{ title, backUrl }`).
- `islands/shell/AppChrome.tsx`: prop becomes `appBar?: AppBar`.
  - `appBar?.mode === "none"` → render **nothing** (no `TopAppBar`, no
    `NavigationBar`, no `MoreSheet`).
  - `appBar?.mode === "detail"` → today's detail bar + nav + more sheet.
  - `undefined` → section-title bar + nav + more sheet (unchanged).
- `routes/shopping/[id]/add.tsx`: set `ctx.state.appBar = { mode: "none" }` and
  drop the `p-4` on `<main>` (the island manages full-width layout). Keep the
  `?q=` read (`initialQuery`) — harmless and lets future entry points prefill.

The app-wide `body { padding-bottom: calc(80px + safe-area) }` in `_app.tsx`
stays; the small dead space below the last result on a nav-less page is
harmless.

### 3. Add page body — clean search-first

`islands/add-items.tsx` renders (top to bottom):

- **Sticky search top bar** (island's first element): a leading **back arrow**
  (`<a href={` + "`/shopping/${listId}`" + `}>` with `Icon name="back"`, matching
  `TopAppBar`), the text `input` (autofocused on mount), and a trailing
  **clear (×)** shown only when there's text. Styling mirrors `TopAppBar`:
  `bg-surface`, ~56px row, `padding-top: env(safe-area-inset-top)`,
  `position: sticky; top: 0; z-index` above the list so results scroll under it.
- **Context line:** "Adding to {listName}".
- **Pinned "Added (N)" section** (see §5) — visible only when N ≥ 1.
- **Main content:**
  - **Idle** (empty query): a centered **hint** — `Icon name="search"` +
    "Search your catalogue" + the subline "Find an item to add, or create a
    new one." **No category chips** — remove `filterCatId`,
    `chipCats`, `chipRow`, and the chip/category branch.
  - **Typing:** the **create-on-no-match** card (kept as-is: exact-match gate →
    category picker sub-view → `addToCatalog`) followed by the **live results
    list** (substring match, one row per catalogue item).

### 4. Add → tweak: inline quantity + note editor sheet

- **Results row** (evolve `CatalogueAddRow`, now add-page-only): when the item
  is **not** on the list, trailing shows an **"Add"** affordance. Once added,
  the trailing shows a compact **`Stepper`** bound to the list item's quantity
  (`updateListItem(listItemId, { quantity })`), and the **row body becomes
  tappable** to open the editor sheet. This covers the immediate "add then
  tweak" case while the query is unchanged.
- **Editor sheet** (new, compact — reuses `Sheet` + `Stepper`): opened via an
  `editingId` signal in the add island. Fields: **quantity** stepper + **note**
  `textarea` + **Done** + **Remove from list**. `flushListItem(id)` on Done and
  on close. **No category field here** — you don't re-file an item mid-add
  (category is set at create time or on the list page). This is intentionally
  *not* the list page's full editor (which carries category + a saved pill);
  the field sets genuinely differ, so we keep a small focused sheet rather than
  a flag-riddled shared component.

### 5. Pinned "Added (N)" section — the building cart

- Track items added **this visit** in a signal `addedThisVisit:
  Set<itemId>`. `handleAdd`/`handleCreate` add the returned item id; **Remove**
  deletes it (and calls `removeListItem`).
- Render as a **collapsible** block pinned under the search bar, **collapsed by
  default**, header "Added · N" with a chevron. It replaces the old
  "· N added" counter (the count lives in the header now). Newest add first.
- Expanded rows: name + inline **`Stepper`** (quantity) + tap-to-edit (opens the
  §4 sheet) + a **remove (×)**. Rows read from the hook's list state filtered to
  `addedThisVisit`, so quantities/notes stay in sync with edits made anywhere.
- An item can briefly appear both in the results (as "added") and in this
  section — expected, like a store's product list + cart. Collapsed-by-default
  keeps that duplication out of sight until the user opens it.

## Components

**New**
- Add-page **editor sheet** (inline in `add-items.tsx`): `Sheet` with `Stepper`
  + note `textarea` + Done + Remove.
- **"Added (N)"** collapsible section (inline in `add-items.tsx`).

**Changed**
- `utils/define.ts` — `AppBar` union (`detail | none`).
- `routes/_app.tsx` — thread the union to `AppChrome`.
- `islands/shell/AppChrome.tsx` — handle `mode: "none"` (render no chrome).
- `routes/shopping/[id]/add.tsx` — `appBar: { mode: "none" }`; drop `p-4`.
- `islands/add-items.tsx` — sticky search bar; remove chips; add editor sheet +
  Added section; wire `updateListItem`/`flushListItem`/`removeListItem`/
  `getItemName`.
- `islands/items.tsx` — remove `SearchBar` + quick-add sheet; add FAB; empty
  copy.
- `components/md3/CatalogueAddRow.tsx` — added-state (inline `Stepper` +
  tappable body); optional `onRemove`.

**Reused unchanged**
- `islands/shell/Fab.tsx`, `hooks/useShoppingList.ts`, `hooks/useSearchBox.ts`,
  `components/md3/{Sheet,Stepper,CategoryPickerList,Icon,Pressable,Button}.tsx`.

## Data flow — no API changes

All mutations go through the existing `useShoppingList` instance in the add
island: `addToList` / `addToCatalog` (add), `updateListItem` (quantity/note,
debounced), `flushListItem` (commit on Done/close), `removeListItem` (remove).
The list page re-reads state on navigation back (server-rendered), so adds/edits
are reflected. No repositories, `services/api.ts`, endpoints, or KV schema
change.

## Edge cases & error handling

- **Idle with prior adds:** hint shows below the pinned "Added (N)" header.
- **Add then keep typing:** the added row filters out of results when it no
  longer matches — that's why the "Added (N)" section exists (persistent home).
- **Remove the last added item:** "Added (N)" header hides when N returns to 0.
- **Create then edit:** `addToCatalog` returns the new id; it enters
  `addedThisVisit` like any add and is immediately tweakable.
- **Optimistic failure:** unchanged from today's hook behavior (out of scope —
  a shared rollback/snackbar is already tracked as a separate follow-up).
- **Back navigation:** a plain link; no unsaved state to guard.

## Testing

- `islands/items.test.tsx` — assert the **FAB "Add items"** renders in Plan
  mode and the quick-add `SearchBar`/sheet strings are **gone**.
- `islands/add-items.test.tsx` — assert the **sticky search bar** + **idle hint**
  render, **category chips are gone**, typing yields results + the create card,
  and (SSR-level) the "Added" section header appears when seeded with a visit
  add. Keep assertions SSR-render-level (the suite has no DOM/nav harness).
- `components/md3/CatalogueAddRow.test.tsx` — cover the added-state (stepper +
  tappable) alongside the not-added "Add" state.
- Gates: `deno task check` && `deno test` && `deno task build`, then live QA in
  the browser (admin/admin, seeded KV, mobile viewport).

## Out of scope (v1)

- Hiding/adjusting the app-wide `body` bottom padding for the nav-less page.
- Sharing one editor component across the list and add pages (field sets
  differ; revisit only if they converge).
- A shared optimistic-rollback + failure snackbar (already a separate
  follow-up).
- Sticky "Added (N)" header (v1 scrolls with content; revisit in QA).
- Recency/frequency-ranked suggestions in the idle state.

## Resolved decisions

- Idle = **clean search-first** (no chips).
- Search bar = **the top bar** (canonical MD3 full-screen search).
- Bottom nav = **hidden** on the add page (fully immersive).
- Add→tweak = **inline quantity + tap-for-note sheet**, with a **pinned
  "Added (N)"** section.
