import { useEffect, useMemo, useRef } from "preact/hooks";
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
  listId: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  { listId, items: catalog, shoppingList, categories: initialCategories }:
    ItemsProps,
) {
  // useMemo with [] ensures useShoppingList is called only once.
  // useShoppingList uses plain signal() (not useSignal), so calling it on every
  // re-render would recreate all signals from SSR props, discarding local state.
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
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );

  const activeTab = useSignal<"list" | "done">("list");
  const lastAddedId = useSignal<string | null>(null);
  const pendingItemIds = useSignal<Set<string>>(new Set());
  const latestItemRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (lastAddedId.value && latestItemRef.current) {
      latestItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
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
    if (id) {
      lastAddedId.value = id;
      reset();
    }
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
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class={`w-5 h-5 transition-transform ${
                pendingCount.value > 0 ? "animate-spin" : ""
              }`}
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

      <section class="pt-2">
        <Show when={() => activeTab.value === "list"}>
          <Show
            when={() => groupedList.value.length > 0}
            fallback={<p>Search and add items to your list.</p>}
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
                        ref={li.id === lastAddedId.value ? latestItemRef : null}
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
            fallback={
              <p class="text-gray-500 text-center py-8">
                No done items yet.
              </p>
            }
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
