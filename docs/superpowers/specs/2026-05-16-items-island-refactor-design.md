# Items Island Refactor & Feature Additions

**Date:** 2026-05-16\
**Status:** Approved

## Context

`islands/items.tsx` is the main interactive component for the shopping list. It
currently handles four distinct responsibilities in a single 255-line file:
catalog search/filter, new item creation, active list item rendering, and
shopping list state management. A non-unique `id="note-input"` bug exists on
line 200 (inside a `.map()`).

Before adding new features, the file needs decomposition so each new concern has
a clear home. The new features are: Done tab (checked-off items with re-add),
item count badges, scroll-to-latest, clear search button, manual refresh, and
loading indicators.

## File Structure

```
components/
  quantity-stepper.tsx       NEW — extracted from islands/items.tsx
  shopping-list-item.tsx     NEW — active list item card
  done-list-item.tsx         NEW — done tab item row

hooks/
  useShoppingList.ts         MODIFIED — checkedItems, checkItem, uncheckItem, refresh, pendingCount

islands/
  items.tsx                  MODIFIED — slimmed to ~120-line coordinator
  search-box.tsx             MODIFIED — adds × clear button
```

Components go into `components/` (not `islands/`) because they receive callbacks
as props from the parent island and don't need independent hydration.

## Hook Changes: `useShoppingList`

### New state

- **`checkedItems: Signal<ShoppingListItemInterface[]>`** — items with
  `checked: true`. On init, the initial `shoppingList` prop is split into `list`
  (checked: false) and `checkedItems` (checked: true).
- **`pendingCount: Signal<number>`** — increments before each API call,
  decrements on completion. Used by the coordinator to show a global sync
  indicator.

### New methods

- **`checkItem(id)`** — triggers exit animation (existing `exitingItems`
  signal + 300ms), then moves item from `list` to `checkedItems`, PATCHes
  `checked: true` in DB.
- **`uncheckItem(id)`** — moves item from `checkedItems` back to `list`, PATCHes
  `checked: false` in DB.
- **`refresh()`** — fetches `api.shoppingList.getAll()`, `api.items.getAll()`,
  `api.categories.getAll()` in parallel, overwrites signals. Sets `pendingCount`
  during the call.

### Existing changes

- `removeListItem` is preserved for permanent deletion (used in Done tab).
- `addToList` and `addToCatalog` return the new item's `id` so the coordinator
  can track `lastAddedId` for scroll-to-latest.

## New Components

### `components/quantity-stepper.tsx`

Direct extraction of the `QuantityStepper` function from `items.tsx` lines
12–40. No behavior change.

```typescript
interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
}
```

### `components/shopping-list-item.tsx`

Extraction of the active list item card (items.tsx lines 186–248). Fixes the
`id="note-input"` bug by removing the unused `id` attribute.

```typescript
interface ShoppingListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  isExiting: boolean;
  isPending: boolean; // drives subtle pulse animation
  onCheck: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ShoppingListItemInterface>) => void;
}
```

The checkmark button shows a spinner icon while `isPending` is true (explicit
action feedback — hint of Approach A).

### `components/done-list-item.tsx`

New component for the Done tab.

```typescript
interface DoneListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  onReAdd: (id: string) => void; // calls uncheckItem
  onRemove: (id: string) => void; // calls removeListItem
}
```

Renders item name, a "Re-add" button, and a permanent delete button.

## Updated `islands/items.tsx` Coordinator

### Local signals (island-level, not in hook)

- **`activeTab: Signal<"list" | "done">`** — default `"list"`.
- **`lastAddedId: Signal<string | null>`** — set after
  `addToList`/`addToCatalog` resolves; cleared after scroll fires.
- **`pendingItemIds: Signal<Set<string>>`** — tracks which specific item IDs
  have in-flight API calls, for per-item pulse.

### Layout

```
<sticky header>
  <SearchBox query={...} ... />      ← now has × clear button
  <RefreshButton />                  ← spins while pendingCount > 0

<tab bar>
  "List (N)" | "Done (N)"            ← N from list.value.length / checkedItems.value.length

<tab content>
  activeTab === "list":
    <Show when={groupedList.value.length > 0} fallback="...">
      <For each={groupedList}>
        <h2>{category}</h2>
        {items.map(li =>
          <ShoppingListItem
            item={li}
            name={getItemName(li.itemId)}
            isExiting={exitingItems.value.includes(li.id)}
            isPending={pendingItemIds.value.has(li.id)}
            onCheck={checkItem}
            onUpdate={updateListItem}
            ref={li.id === lastAddedId.value ? latestItemRef : null}
          />
        )}

  activeTab === "done":
    <For each={checkedItems}>
      <DoneListItem
        item={...}
        name={getItemName(...)}
        onReAdd={uncheckItem}
        onRemove={removeListItem}
      />
```

### Scroll-to-latest

After `addToList` / `addToCatalog` resolves, set `lastAddedId.value = newId`. A
`useEffect` watching `lastAddedId` calls
`latestItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })`
and then clears `lastAddedId`.

### Loading indicators

- **Global sync dot** (Approach B): The refresh button icon pulses / a small
  spinner badge appears in the header when `pendingCount.value > 0`.
- **Per-button spinner** (hint of Approach A): The checkmark button on
  `ShoppingListItem` replaces its SVG with a spinner while `isPending` is true
  for that item's ID.

## Testing Strategy (TDD)

Development follows a red-green-refactor cycle. Tests are written before
implementation for each unit.

**What to test:**

| Unit                                                                                   | Test type             | File                                     |
| -------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| `useShoppingList` — `checkItem`, `uncheckItem`, `refresh`, `pendingCount`              | Unit (Deno test)      | `hooks/useShoppingList.test.ts`          |
| `useShoppingList` — init splitting of `checked` vs active items                        | Unit                  | same                                     |
| `addToList` / `addToCatalog` returning new item ID                                     | Unit                  | same                                     |
| `components/quantity-stepper.tsx`                                                      | Component render test | `components/quantity-stepper.test.tsx`   |
| `components/shopping-list-item.tsx` — `isPending` spinner, `isExiting` animation class | Component render test | `components/shopping-list-item.test.tsx` |
| `components/done-list-item.tsx` — re-add and remove callbacks                          | Component render test | `components/done-list-item.test.tsx`     |

Hook tests use Deno's built-in test runner (`deno test`). Component tests use
`@preact/test-utils` or equivalent shallow render. API calls in hook tests are
mocked at the `services/api.ts` boundary.

**Cycle per feature:**

1. Write a failing test describing the behaviour
2. Implement the minimum code to make it pass
3. Refactor if needed, keeping tests green
4. Run `deno task check` to confirm no lint/type regressions

## Bug Fixes

| Bug                                  | Fix                                                        |
| ------------------------------------ | ---------------------------------------------------------- |
| `id="note-input"` duplicated in list | Remove the `id` attribute — no `<label for>` references it |

## Verification

1. `deno task check` passes (format + lint + type check).
2. `deno task dev` — add several items to list, verify they appear with
   scroll-to-latest behavior.
3. Check off items — verify they disappear from List tab and appear in Done tab.
4. Re-add from Done tab — verify item returns to List tab with `checked: false`
   in DB (`deno task db:view`).
5. Tap quantity stepper rapidly — verify debounced PATCH (single request) and
   sync dot appears briefly.
6. Tap refresh — verify latest DB state loads without page reload or tab reset.
7. Clear search — verify × button resets query and refocuses input.
8. Inspect DOM — verify no duplicate `id` attributes on note inputs.
