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

  const _addToList = async (itemId: string): Promise<string | null> => {
    const entry = await api.shoppingList.add(itemId);
    if (entry) {
      list.value = [...list.value, entry];
      return entry.id ?? null;
    }
    return null;
  };

  const addToList = async (itemId: string): Promise<string | null> => {
    pendingCount.value++;
    try {
      return await _addToList(itemId);
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
          return await _addToList(created.id);
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
    checkedItems.value = checkedItems.value.filter((li) => li.id !== id);
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
      if (!item) {
        exitingItems.value = exitingItems.value.filter((i) => i !== id);
        return;
      }
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
  };
}
