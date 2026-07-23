# Full-Screen "Add Items" Flow — Design

**Date:** 2026-07-13
**Status:** Draft (awaiting review)
**Builds on:** PR #23 (merged to `develop`) — the shared `CategoryPickerList`
and the slimmed, search-first add-item sheet. This feature modifies that sheet.
**Module:** Shopping → List detail (Plan mode)

---

## 1. Problem & context

The add-item **bottom sheet** (`islands/items.tsx`) does too much for its
container. With real household data — many categories, a large catalogue — the
sheet gets cramped:

- The soft keyboard eats ~40–50% of the screen; the bottom-anchored sheet must
  expand toward full height to keep the field + results + create controls
  visible (we cap it at 84%).
- Choosing a category for a **new** item opens a searchable list **inside** the
  sheet (a sheet-within-a-sheet body swap) — the clearest signal the task has
  outgrown a modal bottom sheet.
- Batch-adding while the keyboard is up is tight.

MD3 modal bottom sheets are meant for **focused, short tasks**, not sustained
typing, internal navigation, or batch loops. The fix is to keep a quick sheet
for the light case and give the heavy **search → add → create-with-category**
loop a dedicated full-screen surface (MD3's full-screen search pattern), then
return to the list when done.

## 2. Goals / non-goals

**Goals**
- A full-screen add route for the search / batch-add / create-with-category loop.
- Keep the quick bottom sheet for fast 1–2 item adds (on-the-go ethos).
- Reuse existing repos, API, hooks, and the shared `CategoryPickerList`.
- Return to the list with new items reflected; no explicit save step.

**Non-goals (v1)**
- Changing the **catalogue's** own add flow (a separate surface).
- Creating a new **category** inline on the add page — select existing /
  Uncategorized only. Flagged as an easy later extension.
- Any data-model or API change. No new endpoints; no schema edits.
- Recency/"frequently bought" suggestions, wake lock, drag-reorder — out.

## 3. Product alignment

Happie is a household manager; shopping is one module, and quick add-from-
anywhere is a core use case. The **two-tier** split matches intent:
- **Quick add** (grab milk + bread on the go) → the sheet. One field, tap a
  result, done.
- **Plan a shop** (search, add many, create new with categories) → the page.
  Roomy, keyboard-friendly, no nested surfaces.

## 4. UX design

### 4.1 Two-tier model & entry (expand-from-sheet)

The Plan-mode search bar opens the **quick sheet** as today (search + tap to add
existing catalogue items). The sheet **hands off** to the full page in two ways:

1. An **Expand** control (icon button, `expand`/⤢) in the sheet header.
2. The **"Create '‹query›'"** affordance (shown when the typed text has no exact
   catalogue match).

Both navigate to `/shopping/[id]/add?q=‹current query›`, carrying the query so
the transition feels seamless. On handoff the sheet closes.

Consequently the sheet **sheds** its cramped parts: the inline prominent
"create" card and the in-sheet `CategoryPickerList` (the `catPicking` /
`wantCreate` machinery) are removed. The sheet keeps: autofocus search,
search-first results (no list until typing), and tap-to-add-existing.

### 4.2 The full-screen page

**Route:** `/shopping/[id]/add`, optional `?q=` seed for the search field.

**Top app bar** (shell, detail mode): back arrow → `/shopping/[id]`, title
**"Add items"**. System/Android back behaves identically.

**Body, top → bottom:**

1. **Docked search field**, full width, **autofocus**. Placeholder
   "Search or add an item…". Seeded from `?q=` when present.
2. A compact **"Adding to ‹list› · N added"** sub-header — the running count of
   items added this session, so batch adding feels productive.
3. **Content area**, driven by state:
   - **Idle** (no query, no chip selected): a row of **category filter chips**
     (alphabetical; the categories already loaded). Horizontally scrollable if
     they overflow. **No item list is shown yet** — this avoids dumping a long
     catalogue.
   - **Chip selected:** show that category's catalogue items (a bounded subset)
     as add rows. A selected chip is visually active and can be tapped again to
     clear.
   - **Typing** (non-empty query): text search **across the whole catalogue**;
     selecting a chip is cleared while a query is active (query wins). Results
     render as add rows.
   - **No text match:** a **"Create '‹query›'"** section — item name + an inline
     `CategoryPickerList` (select existing / Uncategorized, searchable, with room
     — no nested surface) + an **Add** button. Creating adds the new item to the
     catalogue **and** to the current list in one action.

**Add rows:** each catalogue result is a row with the item name, its category as
supporting text, and a trailing **＋**. Tapping adds it to the list (qty 1,
optimistic); the row flips to **Added ✓** and stays put so the user can keep
adding (batch). This mirrors the current sheet's row behaviour.

**Return:** back arrow / system back → `/shopping/[id]`. Because every add is
already committed per tap (optimistic write), there is **no save/discard
gate** — returning simply shows the list (re-rendered from the server) with the
new items in place.

### 4.3 Chip ↔ search interplay (precise rules)

- Selecting a chip sets a **category filter**; the body shows that category's
  items.
- Typing any text **takes precedence**: it clears the active chip and searches
  across the whole catalogue.
- Clearing the search field returns to the idle chips (or the last selected
  chip is *not* restored — idle is the clean default).

## 5. Architecture

### 5.1 Route — `routes/shopping/[id]/add.tsx`

Fresh route mirroring `/shopping/[id]`:
- `define.handlers` GET loads, via the existing repositories, the same data the
  list detail needs: the list (name), the catalogue `items`, `categories`, and
  the current list items (for "already added" state). 404/redirect if the list
  is not found or not in the user's household — reuse the list route's guard.
- Sets `ctx.state.appBar = { mode: "detail", title: "Add items", backUrl:
  `/shopping/${id}` }`.
- `define.page` renders the `AddItems` island with those props plus the initial
  `q` from the query string.

### 5.2 Island — `islands/add-items.tsx`

The full-screen experience. Uses `useShoppingList(listId, catalog, shoppingList,
categories)` for add/create/list state (same hook the detail island uses),
`useSearchBox` for text filtering, `CategoryPickerList` inline for the create
section, and a local `useSignal` for the selected category-filter chip and the
running "added" count.

**State model:** the page is its own route/island, seeded from SSR. Adds and
creates hit the **existing** API through the hook (`addToList`, `addToCatalog`).
On return, `/shopping/[id]` re-renders from the server with the new items — no
shared in-memory state between the two islands, no new endpoints.

> **To confirm during planning:** whether `addToCatalog` already links the new
> item to the current list or only creates the catalogue entry. If it only
> creates, the "Create" action composes `addToCatalog` + `addToList` (both
> existing operations — still no API change).

### 5.3 Sheet changes — `islands/items.tsx`

- Remove the inline "create" card, the in-sheet `CategoryPickerList`, and the
  `catPicking` / `wantCreate` signals.
- Keep autofocus, search-first results, tap-to-add-existing.
- Add an **Expand** icon button to the sheet header.
- The "Create '‹q›'" affordance navigates to `/shopping/[id]/add?q=‹q›` instead
  of creating inline.

### 5.4 Shared extraction (DRY)

Extract the **catalogue result row** (name + category supporting text + add /
Added-✓ trailing, with the optimistic tap-to-add) into a small shared component
(e.g. `components/md3/CatalogueAddRow.tsx`) used by both the sheet and the page,
so add-row behaviour lives in one place. `CategoryPickerList` and `useSearchBox`
are already shared and reused as-is.

## 6. File plan (for the implementation plan to expand)

- **Create:** `routes/shopping/[id]/add.tsx` (route + SSR handler).
- **Create:** `islands/add-items.tsx` (full-screen add island).
- **Create:** `components/md3/CatalogueAddRow.tsx` (shared add row).
- **Modify:** `islands/items.tsx` (slim the sheet; add Expand + create→navigate).
- **Reuse (no change):** `components/md3/CategoryPickerList.tsx`,
  `hooks/useSearchBox.ts`, `hooks/useShoppingList.ts`, `services/api.ts`.
- **Tests:** `islands/add-items.test.tsx` (new); adjust `islands/items.test.tsx`.

## 7. Testing

- `add-items` island render tests (preact-render-to-string, matching the
  existing `catalogue.test.tsx` style):
  - idle → category chips render, no item list;
  - a `q` seed → search results render;
  - no-match state → "Create '‹q›'" section renders with the category selector.
- `items.test.tsx`: still renders Plan/Shop; sheet no longer renders the inline
  create card.
- Gates: `deno task check`, `deno test`, `deno task build` all green.
- Live verification (mobile viewport) of the full loop: sheet → expand → page →
  add existing (batch) → create with category → back → items present on the list.

## 8. Rollout

PR #23's work (shared `CategoryPickerList`, slimmed search-first sheet) is
already merged to `develop`, and this feature branch is based on `develop`, so
those pieces are in place. Implementation proceeds via the writing-plans →
subagent-driven-development flow after this spec is approved.

## 9. Risks & open points

- **Running-count placement:** kept in a body sub-header (decoupled) rather than
  injected into the shell app bar, to avoid coupling the island to the app-bar
  mechanism. Revisit if design wants it in the bar.
- **Create = create + add composition:** confirm `addToCatalog` vs `addToList`
  behaviour (see §5.2) — behaviour is fixed by the design; the composition is an
  implementation detail with no API change.
