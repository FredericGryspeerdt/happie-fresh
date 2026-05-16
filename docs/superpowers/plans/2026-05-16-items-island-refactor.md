# Items Island Refactor & Feature Additions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `islands/items.tsx` into focused components, extend `useShoppingList` with checked-item management and refresh, and add Done tab, item count badges, scroll-to-latest, clear search, manual refresh, and loading indicators — all developed test-first.

**Architecture:** `useShoppingList` is refactored from Preact hooks (`useSignal`/`useComputed`) to plain signals (`signal()`/`computed()`) to enable unit testing outside a component. New sub-components (`QuantityStepper`, `ShoppingListItem`, `DoneListItem`) live in `components/` and receive callbacks as props. `islands/items.tsx` becomes a ~120-line coordinator that owns tab state and renders the sub-components.

**Tech Stack:** Deno, Fresh 2, Preact, `@preact/signals`, `jsr:@std/assert`, `jsr:@std/testing/mock`, `jsr:@std/testing/time`, `npm:preact-render-to-string`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `services/api.ts` | Modify | Add `shoppingList.getAll()` |
| `hooks/useShoppingList.ts` | Modify | Replace Preact hooks with plain signals; add `checkedItems`, `checkItem`, `uncheckItem`, `refresh`, `pendingCount`; change `addToList`/`addToCatalog` to return IDs |
| `hooks/useShoppingList.test.ts` | Create | Unit tests for all hook changes |
| `components/quantity-stepper.tsx` | Create | Extracted from `islands/items.tsx` |
| `components/quantity-stepper.test.tsx` | Create | Render test |
| `components/shopping-list-item.tsx` | Create | Active list item card with pending/exiting states |
| `components/shopping-list-item.test.tsx` | Create | Render test |
| `components/done-list-item.tsx` | Create | Done tab item row |
| `components/done-list-item.test.tsx` | Create | Render test |
| `islands/search-box.tsx` | Modify | Add × clear button |
| `islands/items.tsx` | Modify | Full coordinator refactor with tabs, counts, scroll-to-latest, refresh, loading indicator |

---

## Task 1: Add `api.shoppingList.getAll` to the API service

**Files:**
- Modify: `services/api.ts`

- [ ] **Step 1: Add `getAll` to the `shoppingList` namespace**

Open `services/api.ts`. Inside the `shoppingList` object, add `getAll` after the existing `add` method:

```typescript
getAll: async (): Promise<ShoppingListItemInterface[]> => {
  const res = await fetch("/api/shopping-list");
  if (!res.ok) return [];
  return res.json();
},
```

The full `shoppingList` object becomes:

```typescript
shoppingList: {
  getAll: async (): Promise<ShoppingListItemInterface[]> => {
    const res = await fetch("/api/shopping-list");
    if (!res.ok) return [];
    return res.json();
  },
  add: async (itemId: string): Promise<ShoppingListItemInterface | null> => {
    const res = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  patch: async (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ): Promise<void> => {
    await fetch("/api/shopping-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  },
  delete: async (id: string): Promise<void> => {
    await fetch("/api/shopping-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  },
},
```

- [ ] **Step 2: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/api.ts
git commit -m "feat: add shoppingList.getAll to api service"
```

---

## Task 2: Make `useShoppingList` testable (replace Preact hooks with plain signals)

`useSignal` and `useComputed` are Preact lifecycle hooks and cannot be called outside a component. Replacing them with `signal()` and `computed()` makes the hook callable in plain Deno tests with no DOM.

**Files:**
- Modify: `hooks/useShoppingList.ts`

- [ ] **Step 1: Replace imports and hook calls**

Replace the entire contents of `hooks/useShoppingList.ts` with:

```typescript
import { computed, signal } from "@preact/signals";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { api } from "@/services/api.ts";

export function useShoppingList(
  initialCatalog: ItemInterface[],
  initialList: ShoppingListItemInterface[],
  initialCategories: CategoryInterface[] = [],
) {
  const items = signal<ItemInterface[]>(initialCatalog || []);
  const list = signal<ShoppingListItemInterface[]>(
    (initialList || []).filter((li) => !li.checked),
  );
  const checkedItems = signal<ShoppingListItemInterface[]>(
    (initialList || []).filter((li) => li.checked),
  );
  const listItemsMap = computed(() => {
    const map = new Map<string, ShoppingListItemInterface>();
    for (const listItem of list.value) {
      map.set(listItem.itemId || "", listItem);
    }
    return map;
  });
  const exitingItems = signal<string[]>([]);
  const categories = signal<CategoryInterface[]>(initialCategories);
  const selectedCategoryId = signal<string>("");
  const pendingCount = signal<number>(0);

  const patchScheduler = createDebouncedMergeScheduler<
    ShoppingListItemInterface
  >({
    delayMs: 500,
    flush: async (id, patch) => {
      await api.shoppingList.patch(id, patch);
    },
  });

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ) => {
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    patchScheduler.schedule(id, patch);
  };

  const addToList = async (itemId: string): Promise<string | null> => {
    pendingCount.value++;
    try {
      const entry = await api.shoppingList.add(itemId);
      if (entry) {
        list.value = [...list.value, entry];
        return entry.id ?? null;
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const addToCatalog = async (
    name: string,
    categoryId?: string,
  ): Promise<string | null> => {
    if (!name) return null;
    pendingCount.value++;
    try {
      const created = await api.items.create({ name, categoryId });
      if (created) {
        items.value = [...items.value, created];
        if (created.id) {
          // addToList manages its own pendingCount increment/decrement
          return await addToList(created.id);
        }
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const removeListItem = async (id: string) => {
    exitingItems.value = [...exitingItems.value, id];
    await new Promise((resolve) => setTimeout(resolve, 300));

    patchScheduler.cancel(id);
    list.value = list.value.filter((li) => li.id !== id);
    exitingItems.value = exitingItems.value.filter((itemId) => itemId !== id);

    pendingCount.value++;
    try {
      await api.shoppingList.delete(id);
    } finally {
      pendingCount.value--;
    }
  };

  const checkItem = async (id: string) => {
    pendingCount.value++;
    exitingItems.value = [...exitingItems.value, id];
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const item = list.value.find((li) => li.id === id);
      if (!item) return;
      patchScheduler.cancel(id);
      list.value = list.value.filter((li) => li.id !== id);
      exitingItems.value = exitingItems.value.filter((i) => i !== id);
      const checked = { ...item, checked: true };
      checkedItems.value = [...checkedItems.value, checked];
      await api.shoppingList.patch(id, { checked: true });
    } finally {
      pendingCount.value--;
    }
  };

  const uncheckItem = async (id: string) => {
    pendingCount.value++;
    try {
      const item = checkedItems.value.find((li) => li.id === id);
      if (!item) return;
      checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
      const active = { ...item, checked: false };
      list.value = [...list.value, active];
      await api.shoppingList.patch(id, { checked: false });
    } finally {
      pendingCount.value--;
    }
  };

  const refresh = async () => {
    pendingCount.value++;
    try {
      const [newList, newItems, newCategories] = await Promise.all([
        api.shoppingList.getAll(),
        api.items.getAll(),
        api.categories.getAll(),
      ]);
      list.value = newList.filter((li) => !li.checked);
      checkedItems.value = newList.filter((li) => li.checked);
      items.value = newItems;
      categories.value = newCategories;
    } finally {
      pendingCount.value--;
    }
  };

  const getItemName = (itemId?: string) =>
    items.value.find((i) => i.id === itemId)?.name || "Unknown";

  const getItem = (itemId?: string) => items.value.find((i) => i.id === itemId);

  const groupedList = computed(() => {
    type GroupedItems = {
      category: CategoryInterface | null;
      items: ShoppingListItemInterface[];
    };

    const categoryMap = new Map(
      categories.value.map((cat) => [cat.id, cat]),
    );

    const groups = new Map<string | undefined, ShoppingListItemInterface[]>();
    for (const listItem of list.value) {
      const item = getItem(listItem.itemId);
      const categoryId = item?.categoryId;
      if (!groups.has(categoryId)) groups.set(categoryId, []);
      groups.get(categoryId)!.push(listItem);
    }

    const result: GroupedItems[] = [];

    const categorizedGroups = Array.from(groups.entries())
      .filter(([catId]) => catId !== undefined && catId !== null && catId !== "")
      .map(([catId, groupItems]) => ({
        category: categoryMap.get(catId!) || null,
        items: groupItems.sort((a, b) =>
          getItemName(a.itemId).toLowerCase().localeCompare(
            getItemName(b.itemId).toLowerCase(),
          )
        ),
      }))
      .sort((a, b) => (a.category?.order ?? 999) - (b.category?.order ?? 999));

    result.push(...categorizedGroups);

    const uncategorized = groups.get(undefined) || groups.get("") || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        items: uncategorized.sort((a, b) =>
          getItemName(a.itemId).toLowerCase().localeCompare(
            getItemName(b.itemId).toLowerCase(),
          )
        ),
      });
    }

    return result;
  });

  return {
    items,
    list,
    checkedItems,
    exitingItems,
    pendingCount,
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    checkItem,
    uncheckItem,
    refresh,
    getItemName,
    groupedList,
    categories,
    selectedCategoryId,
    listItemsMap,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.ts
git commit -m "refactor: use plain signals in useShoppingList for testability, add checkedItems/checkItem/uncheckItem/refresh/pendingCount"
```

---

## Task 3: Test — init splitting of checked vs active items

**Files:**
- Create: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing test**

Create `hooks/useShoppingList.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { api } from "@/services/api.ts";
import { useShoppingList } from "@/hooks/useShoppingList.ts";
import type {
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, name: string): ItemInterface {
  return { id, name };
}

function makeListItem(
  id: string,
  itemId: string,
  checked = false,
): ShoppingListItemInterface {
  return { id, itemId, userId: "user-1", quantity: 1, checked };
}

// ── init splitting ────────────────────────────────────────────────────────────

Deno.test("useShoppingList — initialises list with only unchecked items", () => {
  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
});

Deno.test("useShoppingList — initialises checkedItems with only checked items", () => {
  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [
      makeListItem("sl-1", "item-1", false),
      makeListItem("sl-2", "item-1", true),
    ],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-2");
});
```

- [ ] **Step 2: Run test to confirm it passes (init splitting is already in Task 2)**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: both tests PASS (the init splitting was implemented in Task 2).

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: init splitting of checked/unchecked items in useShoppingList"
```

---

## Task 4: Test — `checkItem`

**Files:**
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `hooks/useShoppingList.test.ts`:

```typescript
import { FakeTime } from "jsr:@std/testing/time";

// ── checkItem ─────────────────────────────────────────────────────────────────

Deno.test("checkItem — moves item from list to checkedItems", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.list.value, []);
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-1");
  assertEquals(hook.checkedItems.value[0].checked, true);
});

Deno.test("checkItem — item is in exitingItems during the 300ms animation", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");

  // Before advancing time: item should be in exitingItems
  assertEquals(hook.exitingItems.value.includes("sl-1"), true);

  await time.tickAsync(300);
  await promise;

  // After: cleared from exitingItems
  assertEquals(hook.exitingItems.value.includes("sl-1"), false);
});

Deno.test("checkItem — calls api.shoppingList.patch with checked: true", async () => {
  const calls: Array<[string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (id, patch) => {
      calls.push([id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  using time = new FakeTime();
  const promise = hook.checkItem("sl-1");
  await time.tickAsync(300);
  await promise;

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "sl-1");
  assertEquals(calls[0][1], { checked: true });
});
```

- [ ] **Step 2: Run tests**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: checkItem behaviour in useShoppingList"
```

---

## Task 5: Test — `uncheckItem`

**Files:**
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useShoppingList.test.ts`:

```typescript
// ── uncheckItem ───────────────────────────────────────────────────────────────

Deno.test("uncheckItem — moves item from checkedItems back to list", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.list.value.length, 0);

  await hook.uncheckItem("sl-1");

  assertEquals(hook.checkedItems.value, []);
  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-1");
  assertEquals(hook.list.value[0].checked, false);
});

Deno.test("uncheckItem — calls api.shoppingList.patch with checked: false", async () => {
  const calls: Array<[string, Partial<ShoppingListItemInterface>]> = [];
  using _patch = stub(
    api.shoppingList,
    "patch",
    (id, patch) => {
      calls.push([id, patch]);
      return Promise.resolve();
    },
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "sl-1");
  assertEquals(calls[0][1], { checked: false });
});
```

- [ ] **Step 2: Run tests**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: uncheckItem behaviour in useShoppingList"
```

---

## Task 6: Test — `pendingCount`

**Files:**
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useShoppingList.test.ts`:

```typescript
// ── pendingCount ──────────────────────────────────────────────────────────────

Deno.test("pendingCount — starts at 0", () => {
  const hook = useShoppingList([], []);
  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — returns to 0 after uncheckItem completes", async () => {
  using _patch = stub(api.shoppingList, "patch", () => Promise.resolve());

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  await hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("pendingCount — is > 0 while an API call is in flight", async () => {
  let resolveCall!: () => void;
  const slowPatch = new Promise<void>((resolve) => {
    resolveCall = resolve;
  });
  using _patch = stub(api.shoppingList, "patch", () => slowPatch);

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", true)],
  );

  const promise = hook.uncheckItem("sl-1");

  assertEquals(hook.pendingCount.value, 1);

  resolveCall();
  await promise;

  assertEquals(hook.pendingCount.value, 0);
});
```

- [ ] **Step 2: Run tests**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: pendingCount behaviour in useShoppingList"
```

---

## Task 7: Test — `refresh`

**Files:**
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useShoppingList.test.ts`:

```typescript
// ── refresh ───────────────────────────────────────────────────────────────────

Deno.test("refresh — overwrites list and checkedItems from API", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () =>
      Promise.resolve([
        makeListItem("sl-new-1", "item-2", false),
        makeListItem("sl-new-2", "item-2", true),
      ]),
  );
  using _itemsGetAll = stub(
    api.items,
    "getAll",
    () => Promise.resolve([makeItem("item-2", "Eggs")]),
  );
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList(
    [makeItem("item-1", "Milk")],
    [makeListItem("sl-1", "item-1", false)],
  );

  assertEquals(hook.list.value.length, 1);

  await hook.refresh();

  assertEquals(hook.list.value.length, 1);
  assertEquals(hook.list.value[0].id, "sl-new-1");
  assertEquals(hook.checkedItems.value.length, 1);
  assertEquals(hook.checkedItems.value[0].id, "sl-new-2");
  assertEquals(hook.items.value[0].name, "Eggs");
});

Deno.test("refresh — pendingCount returns to 0 after completion", async () => {
  using _getAll = stub(
    api.shoppingList,
    "getAll",
    () => Promise.resolve([]),
  );
  using _itemsGetAll = stub(api.items, "getAll", () => Promise.resolve([]));
  using _catGetAll = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([]),
  );

  const hook = useShoppingList([], []);

  await hook.refresh();

  assertEquals(hook.pendingCount.value, 0);
});
```

- [ ] **Step 2: Run tests**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: refresh behaviour in useShoppingList"
```

---

## Task 8: Test — `addToList` and `addToCatalog` return the new item ID

**Files:**
- Modify: `hooks/useShoppingList.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `hooks/useShoppingList.test.ts`:

```typescript
// ── addToList / addToCatalog return IDs ───────────────────────────────────────

Deno.test("addToList — returns the id of the created list entry", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () =>
      Promise.resolve(
        makeListItem("sl-returned", "item-1", false),
      ),
  );

  const hook = useShoppingList([makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, "sl-returned");
});

Deno.test("addToList — returns null when API call fails", async () => {
  using _add = stub(
    api.shoppingList,
    "add",
    () => Promise.resolve(null),
  );

  const hook = useShoppingList([makeItem("item-1", "Milk")], []);

  const id = await hook.addToList("item-1");

  assertEquals(id, null);
});
```

- [ ] **Step 2: Run tests**

```bash
deno test hooks/useShoppingList.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Run full check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/useShoppingList.test.ts
git commit -m "test: addToList returns new item id"
```

---

## Task 9: Extract `QuantityStepper` component (TDD)

**Files:**
- Create: `components/quantity-stepper.tsx`
- Create: `components/quantity-stepper.test.tsx`
- Modify: `islands/items.tsx` (remove the inlined `QuantityStepper`)

- [ ] **Step 1: Write the failing component test**

Create `components/quantity-stepper.test.tsx`:

```typescript
import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
import { h } from "preact";
import QuantityStepper from "./quantity-stepper.tsx";

Deno.test("QuantityStepper — renders the current value", () => {
  const html = render(h(QuantityStepper, { value: 3, onChange: () => {} }));
  assertStringIncludes(html, "3");
});

Deno.test("QuantityStepper — renders decrement and increment buttons", () => {
  const html = render(h(QuantityStepper, { value: 1, onChange: () => {} }));
  assertStringIncludes(html, "Decrease quantity");
  assertStringIncludes(html, "Increase quantity");
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
deno test components/quantity-stepper.test.tsx
```

Expected: FAIL — `components/quantity-stepper.tsx` does not exist.

- [ ] **Step 3: Create the component**

Create `components/quantity-stepper.tsx`:

```tsx
interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
}

export default function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  return (
    <div class="flex items-center bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-200 active:scale-95 transition-all touch-manipulation"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease quantity"
      >
        <span class="text-xl font-medium">-</span>
      </button>
      <div class="w-10 text-center font-semibold text-gray-800">{value}</div>
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-200 active:scale-95 transition-all touch-manipulation"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <span class="text-xl font-medium">+</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
deno test components/quantity-stepper.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Remove inlined `QuantityStepper` from `islands/items.tsx`**

In `islands/items.tsx`, delete lines 12–40 (the `QuantityStepper` function and its props interface). Add an import at the top:

```typescript
import QuantityStepper from "@/components/quantity-stepper.tsx";
```

- [ ] **Step 6: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/quantity-stepper.tsx components/quantity-stepper.test.tsx islands/items.tsx
git commit -m "refactor: extract QuantityStepper to components/"
```

---

## Task 10: `ShoppingListItem` component (TDD)

**Files:**
- Create: `components/shopping-list-item.tsx`
- Create: `components/shopping-list-item.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `components/shopping-list-item.test.tsx`:

```typescript
import { assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
import { h } from "preact";
import ShoppingListItem from "./shopping-list-item.tsx";
import type { ShoppingListItemInterface } from "@/models/index.ts";

const baseItem: ShoppingListItemInterface = {
  id: "sl-1",
  itemId: "item-1",
  userId: "user-1",
  quantity: 2,
  checked: false,
};

Deno.test("ShoppingListItem — renders item name", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "Milk");
});

Deno.test("ShoppingListItem — applies exiting CSS class when isExiting is true", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: true,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "opacity-0");
});

Deno.test("ShoppingListItem — shows spinner aria-label when isPending is true", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: true,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  assertStringIncludes(html, "Saving");
});

Deno.test("ShoppingListItem — note input has no id attribute (duplicate id bug fix)", () => {
  const html = render(
    h(ShoppingListItem, {
      item: baseItem,
      name: "Milk",
      isExiting: false,
      isPending: false,
      onCheck: () => {},
      onUpdate: () => {},
    }),
  );
  // The old bug: id="note-input" was duplicated across all list items.
  // Verify it is no longer present.
  assertEquals(html.includes('id="note-input"'), false);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
deno test components/shopping-list-item.test.tsx
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Create the component**

Create `components/shopping-list-item.tsx`:

```tsx
import type { ShoppingListItemInterface } from "@/models/index.ts";
import QuantityStepper from "@/components/quantity-stepper.tsx";

interface ShoppingListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  isExiting: boolean;
  isPending: boolean;
  onCheck: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ShoppingListItemInterface>) => void;
}

export default function ShoppingListItem(
  { item, name, isExiting, isPending, onCheck, onUpdate }: ShoppingListItemProps,
) {
  return (
    <li
      class={`p-4 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all duration-300 ease-out ${
        isExiting
          ? "opacity-0 translate-x-12 scale-95"
          : "opacity-100 translate-x-0 scale-100"
      }`}
    >
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 pt-1">
          <span class="font-semibold text-xl text-gray-900 block mb-1">
            {name}
          </span>
          <input
            type="text"
            placeholder="Add a note..."
            value={item.note || ""}
            onInput={(e) =>
              onUpdate(item.id, { note: e.currentTarget.value })}
            class="w-full text-sm text-gray-600 placeholder-gray-400 bg-transparent border-none p-0 focus:ring-0"
          />
        </div>
        <button
          type="button"
          class="ml-4 w-12 h-12 shrink-0 flex items-center justify-center border-2 border-gray-200 rounded-full text-gray-300 active:bg-green-50 active:border-green-500 active:text-green-600 transition-all"
          onClick={() => onCheck(item.id)}
          aria-label={isPending ? "Saving" : "Mark as done"}
          disabled={isPending}
        >
          {isPending
            ? (
              <svg
                class="w-5 h-5 animate-spin text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )
            : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            )}
        </button>
      </div>

      <div class="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
        <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Quantity
        </span>
        <QuantityStepper
          value={item.quantity}
          onChange={(val) => onUpdate(item.id, { quantity: val })}
        />
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
deno test components/shopping-list-item.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/shopping-list-item.tsx components/shopping-list-item.test.tsx
git commit -m "feat: add ShoppingListItem component with isPending spinner and bug fix for duplicate id"
```

---

## Task 11: `DoneListItem` component (TDD)

**Files:**
- Create: `components/done-list-item.tsx`
- Create: `components/done-list-item.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `components/done-list-item.test.tsx`:

```typescript
import { assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
import { h } from "preact";
import DoneListItem from "./done-list-item.tsx";
import type { ShoppingListItemInterface } from "@/models/index.ts";

const baseItem: ShoppingListItemInterface = {
  id: "sl-1",
  itemId: "item-1",
  userId: "user-1",
  quantity: 1,
  checked: true,
};

Deno.test("DoneListItem — renders item name", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Milk");
});

Deno.test("DoneListItem — renders a Re-add button", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Re-add");
});

Deno.test("DoneListItem — renders a delete button", () => {
  const html = render(
    h(DoneListItem, {
      item: baseItem,
      name: "Milk",
      onReAdd: () => {},
      onRemove: () => {},
    }),
  );
  assertStringIncludes(html, "Remove");
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
deno test components/done-list-item.test.tsx
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Create the component**

Create `components/done-list-item.tsx`:

```tsx
import type { ShoppingListItemInterface } from "@/models/index.ts";

interface DoneListItemProps {
  item: ShoppingListItemInterface;
  name: string;
  onReAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function DoneListItem(
  { item, name, onReAdd, onRemove }: DoneListItemProps,
) {
  return (
    <li class="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <span class="font-medium text-gray-500 line-through">{name}</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100 transition-colors"
          onClick={() => onReAdd(item.id)}
        >
          Re-add
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-red-500 bg-red-50 rounded-lg active:bg-red-100 transition-colors"
          onClick={() => onRemove(item.id)}
          aria-label="Remove"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
deno test components/done-list-item.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/done-list-item.tsx components/done-list-item.test.tsx
git commit -m "feat: add DoneListItem component"
```

---

## Task 12: `search-box.tsx` — add × clear button (TDD)

**Files:**
- Modify: `islands/search-box.tsx`

- [ ] **Step 1: Read the current `search-box.tsx`**

```bash
cat islands/search-box.tsx
```

Note the current props interface and how `query` (a signal) and `inputRef` are used.

- [ ] **Step 2: Write the failing test**

Create `islands/search-box.test.tsx`:

```typescript
import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
import { h } from "preact";
import { signal } from "@preact/signals";
import SearchBox from "./search-box.tsx";

Deno.test("SearchBox — renders clear button when query is non-empty", () => {
  const query = signal("milk");
  const html = render(
    h(SearchBox, {
      query,
      results: signal([]),
      inputRef: { current: null },
      renderItem: () => h("li", null, "item"),
      renderEmpty: () => h("div", null, "empty"),
    }),
  );
  assertStringIncludes(html, "Clear search");
});

Deno.test("SearchBox — does not render clear button when query is empty", () => {
  const query = signal("");
  const html = render(
    h(SearchBox, {
      query,
      results: signal([]),
      inputRef: { current: null },
      renderItem: () => h("li", null, "item"),
      renderEmpty: () => h("div", null, "empty"),
    }),
  );
  assertEquals(html.includes("Clear search"), false);
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
deno test islands/search-box.test.tsx
```

Expected: FAIL — "Clear search" button is not rendered yet.

- [ ] **Step 4: Add the × clear button to `islands/search-box.tsx`**

Inside the search input container in `islands/search-box.tsx`, add a clear button that appears when `query.value` is non-empty. Place it absolutely positioned inside the search input wrapper, or as a sibling:

```tsx
{query.value && (
  <button
    type="button"
    aria-label="Clear search"
    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
    onClick={() => {
      query.value = "";
      inputRef.current?.focus();
    }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
    <span class="sr-only">Clear search</span>
  </button>
)}
```

Make the input wrapper `relative` if it is not already.

- [ ] **Step 5: Run test to confirm it passes**

```bash
deno test islands/search-box.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Type-check**

```bash
deno task check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add islands/search-box.tsx islands/search-box.test.tsx
git commit -m "feat: add clear button to SearchBox"
```

---

## Task 13: Refactor `islands/items.tsx` into the coordinator

This task replaces the entire content of `islands/items.tsx` with the coordinator. No unit tests — this is integration of the pieces built in Tasks 2–12.

**Files:**
- Modify: `islands/items.tsx`

- [ ] **Step 1: Replace `islands/items.tsx`**

Replace the full contents of `islands/items.tsx` with:

```tsx
import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import SearchBox from "./search-box.tsx";
import ShoppingListItem from "@/components/shopping-list-item.tsx";
import DoneListItem from "@/components/done-list-item.tsx";

interface ItemsProps {
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  { items: catalog, shoppingList, categories: initialCategories }: ItemsProps,
) {
  const {
    exitingItems,
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    checkItem,
    uncheckItem,
    refresh,
    getItemName,
    groupedList,
    selectedCategoryId,
    listItemsMap,
    categories,
    list,
    checkedItems,
    pendingCount,
  } = useShoppingList(catalog, shoppingList, initialCategories);

  // Island-level state — useSignal persists across re-renders (unlike bare signal())
  const activeTab = useSignal<"list" | "done">("list");
  const lastAddedId = useSignal<string | null>(null);
  const pendingItemIds = useSignal<Set<string>>(new Set());
  const latestItemRef = useRef<HTMLLIElement | null>(null);

  // Scroll to latest added item
  useEffect(() => {
    if (lastAddedId.value && latestItemRef.current) {
      latestItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      lastAddedId.value = null;
    }
  }, [lastAddedId.value]);

  const filterFn = (searchString: string, item: ItemInterface) => {
    if (searchString.trim() === "") return false;
    return !!item?.name?.toLowerCase().includes(searchString.toLowerCase());
  };

  const { query, results, inputRef, reset } = useSearchBox(catalog, filterFn);

  const handleCreateItem = async (searchString: string) => {
    const id = await addToCatalog(
      searchString,
      selectedCategoryId.value || undefined,
    );
    selectedCategoryId.value = "";
    reset();
    if (id) lastAddedId.value = id;
  };

  const handleAddToList = async (itemId: string) => {
    const id = await addToList(itemId);
    if (id) lastAddedId.value = id;
  };

  const handleCheckItem = async (id: string) => {
    pendingItemIds.value = new Set([...pendingItemIds.value, id]);
    try {
      await checkItem(id);
    } finally {
      const next = new Set(pendingItemIds.value);
      next.delete(id);
      pendingItemIds.value = next;
    }
  };

  const renderListItem = (item: Required<ItemInterface>) => {
    const isInList = listItemsMap.value.has(item.id!);
    return (
      <li
        key={item.id}
        class={`flex items-center justify-between p-4 border rounded-xl shadow-sm active:bg-gray-50 transition-colors ${
          isInList
            ? "bg-green-50/50 border-green-200"
            : "bg-white border-gray-100"
        }`}
      >
        <div class="flex items-center gap-2">
          <span
            class={`font-medium text-lg ${
              isInList ? "text-green-900" : "text-gray-800"
            }`}
          >
            {item.name}
          </span>
          {isInList && (
            <span class="px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-green-700 bg-green-200/50 rounded-full">
              Added
            </span>
          )}
        </div>
        <button
          type="button"
          class={`w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-all ${
            isInList
              ? "bg-green-200 text-green-800 active:bg-green-300"
              : "bg-blue-100 text-blue-700 active:bg-blue-200"
          }`}
          onClick={() => item.id && handleAddToList(item.id)}
          aria-label={`Add ${item.name} to list`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2.5"
            stroke="currentColor"
            class="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </li>
    );
  };

  const renderFallback = (searchString: string) => (
    <div class="mt-4 p-4 bg-gray-50 rounded-xl flex flex-col gap-3 border border-dashed border-gray-300">
      <span class="text-gray-600 text-center">
        No matches found for "{searchString}"
      </span>
      <select
        value={selectedCategoryId.value}
        onChange={(e) => selectedCategoryId.value = e.currentTarget.value}
        class="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Uncategorized</option>
        <For each={categories}>
          {(cat) => <option value={cat.id}>{cat.label}</option>}
        </For>
      </select>
      <button
        type="button"
        class="px-6 py-3 bg-green-600 text-white font-medium rounded-xl shadow-sm active:scale-95 transition-transform"
        onClick={() => handleCreateItem(searchString)}
      >
        Create & Add Item
      </button>
    </div>
  );

  return (
    <div class="space-y-8 pb-24">
      {/* Sticky header */}
      <section class="sticky top-0 z-10 bg-white/80 backdrop-blur-md py-4 -mx-4 px-4 border-b border-gray-100 shadow-sm">
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <SearchBox
              query={query}
              results={results}
              inputRef={inputRef}
              renderItem={renderListItem}
              renderEmpty={renderFallback}
            />
          </div>
          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200 transition-all shrink-0"
            onClick={refresh}
            aria-label="Refresh list"
            disabled={pendingCount.value > 0}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class={`w-5 h-5 ${pendingCount.value > 0 ? "animate-spin" : ""}`}
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </section>

      {/* Tab bar */}
      <div class="flex border-b border-gray-200">
        <button
          type="button"
          class={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab.value === "list"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => activeTab.value = "list"}
        >
          List ({list.value.length})
        </button>
        <button
          type="button"
          class={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab.value === "done"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => activeTab.value = "done"}
        >
          Done ({checkedItems.value.length})
        </button>
      </div>

      {/* Tab content */}
      <section class="pt-2">
        <Show when={() => activeTab.value === "list"}>
          <Show
            when={() => groupedList.value.length > 0}
            fallback={<p>Zoek en voeg items toe aan je lijst.</p>}
          >
            <For each={groupedList}>
              {(group) => (
                <div class="mb-6">
                  <h2 class="text-lg font-bold text-gray-700 mb-3 px-2">
                    {group.category?.label || "Uncategorized"}
                  </h2>
                  <ul class="space-y-4">
                    {group.items.map((li: ShoppingListItemInterface) => (
                      <ShoppingListItem
                        key={li.id}
                        item={li}
                        name={getItemName(li.itemId)}
                        isExiting={exitingItems.value.includes(li.id)}
                        isPending={pendingItemIds.value.has(li.id)}
                        onCheck={handleCheckItem}
                        onUpdate={updateListItem}
                        ref={li.id === lastAddedId.value
                          ? latestItemRef
                          : null}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </For>
          </Show>
        </Show>

        <Show when={() => activeTab.value === "done"}>
          <Show
            when={() => checkedItems.value.length > 0}
            fallback={<p class="text-gray-500 text-center py-8">No done items yet.</p>}
          >
            <ul class="space-y-4">
              <For each={checkedItems}>
                {(li) => (
                  <DoneListItem
                    key={li.id}
                    item={li}
                    name={getItemName(li.itemId)}
                    onReAdd={uncheckItem}
                    onRemove={removeListItem}
                  />
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
deno task check
```

Expected: no errors. Fix any type issues before continuing.

- [ ] **Step 3: Run all tests**

```bash
deno test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add islands/items.tsx
git commit -m "feat: refactor items.tsx coordinator with tabs, counts, scroll-to-latest, refresh, and loading indicators"
```

---

## Verification

Run these after all tasks are complete:

- [ ] `deno task check` — format + lint + types all pass
- [ ] `deno test` — all tests pass
- [ ] `deno task dev` — add several items, observe scroll-to-latest behavior
- [ ] Check off items — they disappear from List tab and appear in Done tab with correct count badges
- [ ] Re-add from Done tab — item returns to List tab; confirm `checked: false` in DB with `deno task db:view`
- [ ] Tap quantity stepper rapidly — observe sync spinner in header during debounced save
- [ ] Tap refresh — DB state reloads without page reload; active tab remains unchanged
- [ ] Clear search with × button — query resets and input is refocused
- [ ] Inspect DOM — confirm no duplicate `id` attributes on note inputs
