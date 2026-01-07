import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { For, Show } from "@preact/signals/utils";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import SearchBox from "./search-box.tsx";

// --- Components ---

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
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
    getItemName,
    groupedList,
    selectedCategoryId,
    listItemsMap,
    categories,
  } = useShoppingList(catalog, shoppingList, initialCategories);

  const filterFn = (searchString: string, item: ItemInterface) => {
    if (searchString.trim() === "") return false;
    return !!item?.name?.toLowerCase().includes(searchString.toLowerCase());
  };

  const { query, results, inputRef, reset } = useSearchBox(catalog, filterFn);

  const handleCreateItem = (searchString: string) => {
    addToCatalog(searchString, selectedCategoryId.value || undefined);
    selectedCategoryId.value = "";
    reset();
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
          onClick={() => item.id && addToList(item.id)}
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
      <div class="mb-0">
        <SearchBox
          query={query}
          results={results}
          inputRef={inputRef}
          renderItem={renderListItem}
          renderEmpty={renderFallback}
        />
        </div>
      </section>

      <section class="pt-2">
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
                  {group.items.map((li: ShoppingListItemInterface) => {
                    const isExiting = exitingItems.value.includes(li.id);
                    return (
                      <li
                        key={li.id}
                        class={`p-4 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all duration-300 ease-out ${
                          isExiting
                            ? "opacity-0 translate-x-12 scale-95"
                            : "opacity-100 translate-x-0 scale-100"
                        }`}
                      >
                        <div class="flex items-start justify-between mb-4">
                          <div class="flex-1 pt-1">
                            <span class="font-semibold text-xl text-gray-900 block mb-1">
                              {getItemName(li.itemId)}
                            </span>
                            <input
                              id="note-input"
                              type="text"
                              placeholder="Add a note..."
                              value={li.note || ""}
                              onInput={(e) =>
                                updateListItem(li.id, {
                                  note: e.currentTarget.value,
                                })}
                              class="w-full text-sm text-gray-600 placeholder-gray-400 bg-transparent border-none p-0 focus:ring-0"
                            />
                          </div>
                          <button
                            type="button"
                            class="ml-4 w-12 h-12 shrink-0 flex items-center justify-center border-2 border-gray-200 rounded-full text-gray-300 active:bg-green-50 active:border-green-500 active:text-green-600 transition-all"
                            onClick={() => removeListItem(li.id)}
                            aria-label="Mark as done"
                          >
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
                          </button>
                        </div>

                        <div class="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
                          <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Quantity
                          </span>
                          <QuantityStepper
                            value={li.quantity}
                            onChange={(val) =>
                              updateListItem(li.id, { quantity: val })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </For>
        </Show>
      </section>
    </div>
  );
}
