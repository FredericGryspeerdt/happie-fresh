# Add This Week's Ingredients to a Shopping List — Design Spec

**Date:** 2026-09-08 **Status:** Approved **Issue:**
[#100](https://github.com/FredericGryspeerdt/happie-fresh/issues/100) (part of
#14)

## Overview

Once the weekly menu is assembled, the household pushes the ingredients of the
planned dishes onto a shopping list in one go, after reviewing them.

Vocabulary comes from [`CONTEXT.md`](../../../CONTEXT.md): **dish**,
**ingredient** (a catalogue **item** a dish calls for), **weekly menu**,
**shopping list**.

**In scope:**

- A menu-side action on _This week_ that adds the week's ingredients to one
  shopping list.
- Resolving the target list without asking whenever possible, showing it inside
  the review with a Change action, remembering the last-used list household-wide,
  creating a list inline when there is none.
- A review sheet before anything is written.
- One bulk endpoint on the list that performs the dedup server-side.

**Out of scope (follow-ups):** per-dish add (#101), a shopping-side entry point
(#102), remembering pantry staples (#103), quantities on dish ingredients.

---

## Behaviour

### Entry point

A full-width filled button **"Add to shopping list"** sits under the _This
week_ header, only when the week has at least one dish. Any member may use it;
it is not manager-gated (adding to a list is not destructive).

### Choosing the target list

_Revised 2026-09-09._ The list is a **parameter of the review, not a step
before it**. The picker is an exception path, never a routine second sheet.

When the button is tapped, the target list is resolved without asking whenever
it can be:

1. Exactly one shopping list → it is the target.
2. Several lists and the remembered list (see _Remembering_) still exists → it
   is the target.
3. Several lists and nothing usable is remembered → the picker sheet opens
   first, once; from then on the household's choice is remembered.
4. Zero lists → the "New shopping list" dialog opens directly, prefilled
   **"Groceries"**, editable. Creating the list continues to the review.

The review names its target in its first row and offers **"Change"** whenever
the household has more than one list. Change closes the review, opens the
picker sheet with the **current** list marked, and picking a list reopens the
review recomputed for that list. Cancelling the picker from Change returns to
the review with the previous list; cancelling the first-time picker returns to
the menu. The picker also offers "New list" (the same dialog as case 4), and a
list created there becomes the target.

Ticks the member has already un-set are **kept** when the list changes: "we
have salt at home" does not depend on which list is being written.

### Remembering the last-used list

The chosen list id is stored **household-wide on the weekly menu record**
(`shoppingListId`). It is a preference, not a "was this shopped" flag. If the
remembered list no longer exists, the picker opens as if nothing were
remembered (case 3 above).

### Preview sheet

- Title: **"Add to shopping list"**.
- First row: the target list (cart icon, list name, supporting text "Adding to
  this list") with a **"Change"** action when the household has more than one
  list; otherwise the row is plain.
- Rows: the **deduped** ingredients of every planned dish, **flat and
  alphabetical** by item name, with the names of the dishes that call for it as
  supporting text ("Lasagne, Curry").
- Row start states:
  - **new** (not on the list) → ticked, tappable.
  - **on-list** (on the list, unchecked) → greyed, locked, supporting text
    "Already on the list".
  - **bought** (on the list, checked) → ticked, tappable, supporting text "Will
    be put back · <dish names>".
- Ingredients whose catalogue item no longer exists are skipped silently.
  Planned dishes whose dish record no longer exists are skipped silently.
- **Dishes with no (resolvable) ingredients** are listed under a subheader "No
  ingredients yet"; tapping one opens that dish's editor (`/menu/<dishId>`).
- Per-row ticks only; no select-all/none.
- Confirm button: **"Add N items"** (singular "Add 1 item"), disabled at zero,
  shows the loading spinner while the write is in flight (pessimistic create,
  patterns doc §1/§4).

### The write

One request to a new bulk endpoint on the target list. The **server** decides
per ingredient:

| Existing entry for the item on the list | Action                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| none                                    | create entry: `quantity: 1`, `checked: false`, `note` = dish names  |
| unchecked                               | leave it; fill `note` only if it is empty                           |
| checked                                 | set `checked: false`; fill `note` only if it is empty               |

Never overwrite a note someone wrote. Never bump `quantity` — dishes carry no
quantities, so "two dishes need pasta" is not "two packs". Item ids unknown to
the household's catalogue are ignored. The whole write is one atomic KV commit
so two people tapping at once cannot double-add.

### Afterwards

Snackbar **"Added N to <list name>"** with a single action **"Open list"**
(navigates to `/shopping/<listId>`). When the server added and restored nothing
(everything raced onto the list already), the snackbar says "Everything was
already on the list". On failure: "Couldn't add to the list — try again", the
preview stays open.

The menu stores **no shopped state**; the list is the source of truth and a
repeat press simply finds everything already on the list.

---

## Data & API

- `WeeklyMenuInterface.shoppingListId?: string` — last-used list.
- `PATCH /api/menu/plan` accepts `{ shoppingListId }` (list must belong to the
  household → else 400).
- `POST /api/shopping/lists/:id/items/bulk` body
  `{ items: [{ itemId, note? }] }` → `201` with
  `{ added: ShoppingListItem[], restored: ShoppingListItem[], skipped: itemId[] }`.
  `added` = created, `restored` = previously checked and now unchecked,
  `skipped` = already unchecked on the list. 400 on an empty/invalid body or more
  than 500 items; 403 when the list is not the caller's.
- Pure function `collectIngredients(entries, dishes, items, listItems)` builds
  the preview rows and the empty-dish list; it is the single place the dedup and
  state rules live on the client.
