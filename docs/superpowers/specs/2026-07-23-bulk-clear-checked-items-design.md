# Bulk-clear checked items — Design

**Issue:** [#33 — Add API support for bulk clearing checked items in shopping
list](https://github.com/FredericGryspeerdt/happie-fresh/issues/33)

**Date:** 2026-07-23

## Problem

Clearing the checked-off items from a shopping list currently issues **one
DELETE request per item**. The "Clear checked items" action in
`islands/items.tsx` loops over every checked id and `await`s `removeListItem(id)`
sequentially — each call is a separate network round-trip _and_ waits out a
300ms exit animation. For a cart with N checked items this is N requests and at
least N×300ms of latency.

## Goal

Clear all checked items in a single API call, and wire the existing UI action to
use it — turning N sequential requests into 1.

"Clearing" means **permanent deletion** of the checked items (the current
behaviour), not merely un-checking them.

## Non-goals

- Undo / restore of cleared items.
- Bulk operations other than clearing checked items (e.g. bulk check/uncheck).
- Changing the single-item DELETE semantics.

## Design

### 1. Repository — `ShoppingListItemRepo.clearChecked`

New method in `database/shopping-list-item.repo.ts`:

```ts
static async clearChecked(listId: string): Promise<number> {
  const kv = await getKv();
  let atomic = kv.atomic();
  let count = 0;
  for await (
    const entry of kv.list<ShoppingListItemInterface>({
      prefix: ["shopping_list_items", listId],
    })
  ) {
    if (entry.value.checked) {
      atomic = atomic.delete(entry.key);
      count++;
    }
  }
  if (count === 0) return 0;
  const ok = await atomic.commit();
  if (!ok) throw new Error("Failed to clear checked items.");
  return count;
}
```

- Deletes **only** items where `checked === true`; unchecked items are
  untouched.
- All deletes commit in a single atomic transaction, mirroring the established
  batch pattern in `CategoryRepo.reorder`.
- Returns the number of items cleared. Empty case commits nothing and returns
  `0`.

### 2. API endpoint — dedicated route

New file `routes/api/shopping/lists/[id]/items/checked.ts` exposing a `DELETE`
handler, i.e. `DELETE /api/shopping/lists/:id/items/checked`. The "checked
items" sub-collection is treated as its own resource.

- Authorization: household → list-ownership check, identical to the sibling
  `items.ts` route. On failure return `403 Forbidden`.
- Success: `200` with body `{ cleared: <number> }` (the count may be `0`).

**Auth helper extraction.** `authorizeList(ctx, listId)` currently lives as a
private function inside `routes/api/shopping/lists/[id]/items.ts`. To avoid
duplicating it across the two sibling routes, extract it into a small
co-located, non-routed module (underscore-prefixed so Fresh does not treat it as
a route, e.g. `routes/api/shopping/lists/[id]/_list-auth.ts`). Both `items.ts`
and `checked.ts` import it. Fresh 2's underscore-exclusion behaviour and the
`define.handlers` signature will be confirmed against the live docs (Context7)
before coding; if underscore-exclusion is not reliable, fall back to a helper
under `utils/`.

### 3. Client service

Add to `services/api.ts` under `shoppingList`:

```ts
clearChecked: async (listId: string): Promise<number | null> => {
  const res = await fetch(`/api/shopping/lists/${listId}/items/checked`, {
    method: "DELETE",
  });
  if (!res.ok) return null; // null signals failure so the caller can roll back
  return (await res.json()).cleared as number;
},
```

Returning `number | null` lets the hook distinguish "nothing to clear" (`0`)
from "request failed" (`null`).

### 4. Hook — `useShoppingList.clearCheckedItems`

Optimistic single-shot clear that replaces the per-item loop:

```ts
const clearCheckedItems = async () => {
  const snapshot = checkedItems.value;
  if (snapshot.length === 0) return;
  // cancel any in-flight debounced writes for the items being cleared
  for (const li of snapshot) if (li.id) patchScheduler.cancel(li.id);
  checkedItems.value = [];
  pendingCount.value++;
  try {
    const cleared = await api.shoppingList.clearChecked(listId);
    if (cleared === null) checkedItems.value = snapshot; // rollback on failure
  } finally {
    pendingCount.value--;
  }
};
```

Exposed from the hook's return object.

**Concurrency note:** if an item is checked while the clear request is in
flight and the request then fails, the rollback restores the pre-clear snapshot
and the concurrently-checked item is dropped from `checkedItems` in memory (it
still exists server-side and reappears on next `refresh`). This is an accepted
edge case for an optimistic single-user-per-moment flow.

### 5. UI wiring

In `islands/items.tsx`, the "Clear checked items" `ListItem` `onClick` currently
does:

```ts
const ids = checkedItems.value.map((li) => li.id!).filter(Boolean);
mgmtOpen.value = false;
for (const id of ids) await removeListItem(id);
```

Replace with:

```ts
mgmtOpen.value = false;
await clearCheckedItems();
```

`clearCheckedItems` is destructured from `useShoppingList`.

## Error handling

| Situation                | Result                                  |
| ------------------------ | --------------------------------------- |
| List not owned by caller | `403 Forbidden`                         |
| Nothing checked          | `200 { cleared: 0 }` (no KV write)      |
| Atomic commit fails      | throws → `500`                          |
| Client request fails     | service returns `null` → hook rolls back|

## Testing

Built test-first (TDD).

- **Repo test** — new `database/shopping-list-item.repo.test.ts` using an
  in-memory KV (`KV_PATH=":memory:"`, unique `listId`s per case):
  - clears only checked items and returns the correct count;
  - leaves unchecked items intact;
  - returns `0` for a list with nothing checked.

  Because these tests exercise Deno KV, add a `"test": "deno test --unstable-kv
  -A"` task to `deno.json` and update the test-command note in `CLAUDE.md`
  (bare `deno test` cannot open KV without `--unstable-kv`).

- **Hook test** — extend `hooks/useShoppingList.test.ts` using the existing
  `stub` pattern on `api.shoppingList.clearChecked`:
  - success empties `checkedItems` with exactly one api call;
  - failure (stub returns `null`) rolls `checkedItems` back to its prior value.

## Verification

- `deno task check` (fmt + lint + type check) green.
- `deno task test` green.
- Manual: check off items, use "Clear checked items", confirm a single
  `DELETE .../items/checked` request in the network panel and that the checked
  section empties.
