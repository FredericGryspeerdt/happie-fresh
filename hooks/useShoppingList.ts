import { useComputed, useSignal } from "@preact/signals";
import { useMemo, useRef } from "preact/hooks";
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
  const items = useSignal<ItemInterface[]>(initialCatalog || []);
  const list = useSignal<ShoppingListItemInterface[]>(initialList || []);
  const search = useSignal("");
  const exitingItems = useSignal<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasSearchQuery = useComputed(() => search.value.trim().length > 0);
  const categories = useSignal<CategoryInterface[]>(initialCategories);
  const selectedCategoryId = useSignal<string>("");

  // Debounced scheduler for PATCH requests
  const patchScheduler = useMemo(
    () =>
      createDebouncedMergeScheduler<ShoppingListItemInterface>({
        delayMs: 500,
        flush: async (id, patch) => {
          await api.shoppingList.patch(id, patch);
        },
      }),
    [],
  );

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ) => {
    // Optimistic update
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    patchScheduler.schedule(id, patch);
  };

  const addToList = async (itemId: string) => {
    const entry = await api.shoppingList.add(itemId);
    if (entry) {
      list.value = [...list.value, entry];
      search.value = "";
      searchInputRef.current?.focus();
    }
  };

  const addToCatalog = async (categoryId?: string) => {
    const name = search.value.trim();
    if (!name) return;
    const created = await api.items.create(name, categoryId);
    if (created) {
      items.value = [...items.value, created];
      if (created.id) {
        await addToList(created.id);
      }
    }
  };

  const removeListItem = async (id: string) => {
    // Trigger exit animation
    exitingItems.value = [...exitingItems.value, id];
    await new Promise((resolve) => setTimeout(resolve, 300));

    patchScheduler.cancel(id);
    list.value = list.value.filter((li) => li.id !== id);
    exitingItems.value = exitingItems.value.filter((itemId) => itemId !== id);

    await api.shoppingList.delete(id);
  };

  const filteredItems = useComputed(() => {
    if (search.value.trim() === "") return [];
    return (items.value || []).filter((item) =>
      item?.name?.toLowerCase().includes(search.value.toLowerCase())
    );
  });

  const getItemName = (itemId?: string) =>
    items.value.find((i) => i.id === itemId)?.name || "Unknown";

  const getItem = (itemId?: string) => items.value.find((i) => i.id === itemId);

  // Group shopping list items by category
  const groupedList = useComputed(() => {
    type GroupedItems = {
      category: CategoryInterface | null;
      items: ShoppingListItemInterface[];
    };

    // Create a map of categoryId -> category with order
    const categoryMap = new Map(
      categories.value.map((cat) => [cat.id, cat]),
    );

    // Group items by categoryId
    const groups = new Map<string | undefined, ShoppingListItemInterface[]>();

    for (const listItem of list.value) {
      const item = getItem(listItem.itemId);
      const categoryId = item?.categoryId;

      if (!groups.has(categoryId)) {
        groups.set(categoryId, []);
      }
      groups.get(categoryId)!.push(listItem);
    }

    // Convert to sorted array of groups
    const result: GroupedItems[] = [];

    // Add categorized groups first, sorted by category order
    const categorizedGroups = Array.from(groups.entries())
      .filter(([catId]) =>
        catId !== undefined && catId !== null && catId !== ""
      )
      .map(([catId, items]) => ({
        category: categoryMap.get(catId!) || null,
        items: items.sort((a, b) => {
          const nameA = getItemName(a.itemId).toLowerCase();
          const nameB = getItemName(b.itemId).toLowerCase();
          return nameA.localeCompare(nameB);
        }),
      }))
      .sort((a, b) => {
        const orderA = a.category?.order ?? 999;
        const orderB = b.category?.order ?? 999;
        return orderA - orderB;
      });

    result.push(...categorizedGroups);

    // Add uncategorized group last
    const uncategorized = groups.get(undefined) || groups.get("") || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        items: uncategorized.sort((a, b) => {
          const nameA = getItemName(a.itemId).toLowerCase();
          const nameB = getItemName(b.itemId).toLowerCase();
          return nameA.localeCompare(nameB);
        }),
      });
    }

    return result;
  });

  return {
    items,
    list,
    search,
    exitingItems,
    searchInputRef,
    filteredItems,
    updateListItem,
    addToList,
    addToCatalog,
    removeListItem,
    getItemName,
    hasSearchQuery,
    groupedList,
    categories,
    selectedCategoryId,
  };
}
