import { computed, signal } from "@preact/signals";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useShoppingList(
  listId: string,
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
  // Mirror each in-flight mutation into the global loading bar.
  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };
  // Bumped whenever a debounced list-item write actually flushes to the API,
  // so the UI can show a "Saved" indicator tied to the real write (not keystrokes).
  const lastSaved = signal<number>(0);

  // Ids of list items whose debounced write hasn't flushed yet (drives "Saving…").
  const savingIds = signal<Set<string>>(new Set());
  const markSaving = (id: string) => {
    if (savingIds.value.has(id)) return;
    const next = new Set(savingIds.value);
    next.add(id);
    savingIds.value = next;
  };
  const clearSaving = (id: string) => {
    if (!savingIds.value.has(id)) return;
    const next = new Set(savingIds.value);
    next.delete(id);
    savingIds.value = next;
  };

  const patchScheduler = createDebouncedMergeScheduler<
    ShoppingListItemInterface
  >({
    delayMs: 500,
    flush: async (id, patch) => {
      await api.shoppingList.updateItem(listId, id, patch);
      clearSaving(id);
      lastSaved.value = lastSaved.value + 1;
    },
  });

  /** Immediately flush the pending debounced write for a list item (e.g. on editor close). */
  const flushListItem = (id: string) => patchScheduler.flush(id);

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ) => {
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    markSaving(id);
    patchScheduler.schedule(id, patch);
  };

  const _addToList = async (itemId: string): Promise<string | null> => {
    const entry = await api.shoppingList.addItem(listId, itemId);
    if (entry) {
      list.value = [...list.value, entry];
      return entry.id ?? null;
    }
    return null;
  };

  const addToList = async (itemId: string): Promise<string | null> => {
    startPending();
    try {
      return await _addToList(itemId);
    } finally {
      endPending();
    }
  };

  const addToCatalog = async (
    name: string,
    categoryId?: string,
  ): Promise<string | null> => {
    if (!name) return null;
    startPending();
    try {
      const created = await api.items.create({ name, categoryId });
      if (created) {
        items.value = [...items.value, created];
        if (created.id) {
          return await _addToList(created.id);
        }
      }
      return null;
    } finally {
      endPending();
    }
  };

  const removeListItem = async (id: string) => {
    exitingItems.value = [...exitingItems.value, id];
    await new Promise((resolve) => setTimeout(resolve, 300));

    patchScheduler.cancel(id);
    clearSaving(id);
    list.value = list.value.filter((li) => li.id !== id);
    checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
    exitingItems.value = exitingItems.value.filter((itemId) => itemId !== id);

    startPending();
    try {
      await api.shoppingList.removeItem(listId, id);
    } finally {
      endPending();
    }
  };

  const checkItem = async (id: string) => {
    startPending();
    exitingItems.value = [...exitingItems.value, id];
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const item = list.value.find((li) => li.id === id);
      if (!item) {
        exitingItems.value = exitingItems.value.filter((i) => i !== id);
        return;
      }
      patchScheduler.cancel(id);
      clearSaving(id);
      list.value = list.value.filter((li) => li.id !== id);
      exitingItems.value = exitingItems.value.filter((i) => i !== id);
      const checked = { ...item, checked: true };
      checkedItems.value = [...checkedItems.value, checked];
      await api.shoppingList.updateItem(listId, id, { checked: true });
    } finally {
      endPending();
    }
  };

  const uncheckItem = async (id: string) => {
    startPending();
    try {
      const item = checkedItems.value.find((li) => li.id === id);
      if (!item) return;
      checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
      const active = { ...item, checked: false };
      list.value = [...list.value, active];
      await api.shoppingList.updateItem(listId, id, { checked: false });
    } finally {
      endPending();
    }
  };

  const refresh = async () => {
    startPending();
    try {
      const [newList, newItems, newCategories] = await Promise.all([
        api.shoppingList.getItems(listId),
        api.items.getAll(),
        api.categories.getAll(),
      ]);
      list.value = newList.filter((li) => !li.checked);
      checkedItems.value = newList.filter((li) => li.checked);
      items.value = newItems;
      categories.value = newCategories;
    } finally {
      endPending();
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
      .filter(([catId]) =>
        catId !== undefined && catId !== null && catId !== ""
      )
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
    lastSaved,
    savingIds,
    flushListItem,
  };
}
