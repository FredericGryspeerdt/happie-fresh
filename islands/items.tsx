import { useComputed, useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import { ItemInterface, ShoppingListItemInterface } from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { For } from "@preact/signals/utils";

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

function SearchInput({
  value,
  onInput,
}: {
  value: string;
  onInput: (val: string) => void;
}) {
  return (
    <div class="relative">
      <input
        type="text"
        placeholder="Search items..."
        value={value}
        onInput={(e) => onInput(e.currentTarget.value)}
        class="w-full p-4 pl-12 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
      />
      <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
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
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      </div>
    </div>
  );
}

interface ItemsProps {
  items: ItemInterface[];
  shoppingList: ShoppingListItemInterface[];
}

export default function Items({ items: catalog, shoppingList }: ItemsProps) {
  const items = useSignal<ItemInterface[]>(catalog || []);
  const list = useSignal<ShoppingListItemInterface[]>(shoppingList || []);
  const search = useSignal("");
  const exitingItems = useSignal<string[]>([]);

  // debounced scheduler to batch rapid updates into single PATCH requests
  const patchScheduler = useMemo(
    () =>
      createDebouncedMergeScheduler<ShoppingListItemInterface>({
        delayMs: 500,
        flush: async (id, patch) => {
          await fetch("/api/shopping-list", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...patch }),
          });
        },
      }),
    []
  );

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>
  ) => {
    // Optimistically update local state for immediate UI responsiveness.
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    patchScheduler.schedule(id, patch);
  };

  const addToCatalog = async () => {
    const name = search.value.trim();
    if (!name) return;
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const created: ItemInterface = await res.json();
      items.value = [...items.value, created];
      if (created?.id) {
        await addToList(created.id);
      }
    }
  };
  const filteredItems = useComputed(() => {
    if (search.value.trim() === "") return [];
    return (items.value || []).filter((item) =>
      item?.name?.toLowerCase().includes(search.value.toLowerCase())
    );
  });

  const addToList = async (itemId: string) => {
    const res = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) {
      const entry = await res.json();
      list.value = [...list.value, entry];
    }
  };

  const removeListItem = async (id: string) => {
    // Trigger exit animation
    exitingItems.value = [...exitingItems.value, id];
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Cancel any pending debounced PATCH for this item before deletion.
    patchScheduler.cancel(id);
    list.value = list.value.filter((li) => li.id !== id);

    // Cleanup exiting state
    exitingItems.value = exitingItems.value.filter((itemId) => itemId !== id);

    await fetch("/api/shopping-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const getItemName = (itemId?: string) =>
    items.value.find((i) => i.id === itemId)?.name || "Unknown";

  return (
    <div class="space-y-8 pb-24">
      <section>
        <div class="mb-4">
          <SearchInput
            value={search.value}
            onInput={(v) => (search.value = v)}
          />
        </div>
        <ul class="space-y-2">
          <For
            each={filteredItems}
            fallback={
              filteredItems.value.length === 0 &&
              search.value.trim().length > 0 && (
                <div class="mt-4 p-4 bg-gray-50 rounded-xl flex flex-col items-center gap-3 text-center border border-dashed border-gray-300">
                  <span class="text-gray-600">
                    No matches found for "{search.value}"
                  </span>
                  <button
                    type="button"
                    class="px-6 py-3 bg-green-600 text-white font-medium rounded-xl shadow-sm active:scale-95 transition-transform w-full sm:w-auto"
                    onClick={addToCatalog}
                  >
                    Create & Add Item
                  </button>
                </div>
              )
            }
          >
            {(item) => (
              <li
                key={item.id}
                class="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm active:bg-gray-50 transition-colors"
              >
                <span class="font-medium text-gray-800 text-lg">
                  {item.name}
                </span>
                <button
                  type="button"
                  class="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full active:bg-blue-200 active:scale-95 transition-all"
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
            )}
          </For>
        </ul>
      </section>

      <section>
        <ul class="space-y-4">
          <For each={list}>
            {(li) => {
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
                        type="text"
                        placeholder="Add a note..."
                        value={li.note || ""}
                        onInput={(e) =>
                          updateListItem(li.id, { note: e.currentTarget.value })
                        }
                        class="w-full text-sm text-gray-600 placeholder-gray-400 bg-transparent border-none p-0 focus:ring-0"
                      />
                    </div>
                    <button
                      type="button"
                      class="ml-4 w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 border-gray-200 rounded-full text-gray-300 active:bg-green-50 active:border-green-500 active:text-green-600 transition-all"
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
                        updateListItem(li.id, { quantity: val })
                      }
                    />
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
      </section>
    </div>
  );
}
