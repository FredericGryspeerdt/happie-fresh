import { useComputed, useSignal } from "@preact/signals";
import { useMemo, useRef } from "preact/hooks";
import { ItemInterface, ShoppingListItemInterface } from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { api } from "@/services/api.ts";

export function useShoppingList(
  initialCatalog: ItemInterface[],
  initialList: ShoppingListItemInterface[],
) {
  const items = useSignal<ItemInterface[]>(initialCatalog || []);
  const list = useSignal<ShoppingListItemInterface[]>(initialList || []);
  const search = useSignal("");
  const exitingItems = useSignal<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasSearchQuery = useComputed(() => search.value.trim().length > 0);

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

  const addToCatalog = async () => {
    const name = search.value.trim();
    if (!name) return;
    const created = await api.items.create(name);
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
  };
}
