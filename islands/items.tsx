import { useComputed, useSignal } from "@preact/signals";
import { ItemInterface, ShoppingListItemInterface } from "@/models/index.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
interface ItemsProps {
  items: ItemInterface[];
  shoppingList: ShoppingListItemInterface[];
}

export default function Items({ items: catalog, shoppingList }: ItemsProps) {
  const items = useSignal<ItemInterface[]>(catalog || []);
  const list = useSignal<ShoppingListItemInterface[]>(shoppingList || []);
  const search = useSignal("");

  const scheduler = createDebouncedMergeScheduler<ShoppingListItemInterface>({
    delayMs: 500,
    flush: async (id, patch) => {
      await fetch("/api/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
    },
  });

  const updateListItem = (
    id: string,
    patch: Partial<ShoppingListItemInterface>
  ) => {
    // Optimistically update local state for immediate UI responsiveness.
    list.value = list.value.map((li) =>
      li.id === id ? { ...li, ...patch } : li
    );
    scheduler.schedule(id, patch);
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
  const filteredItems = useComputed(() =>
    (items.value || []).filter((item) =>
      item?.name?.toLowerCase().includes(search.value.toLowerCase())
    )
  );

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
    // Cancel any pending debounced PATCH for this item before deletion.
    scheduler.cancel(id);
    list.value = list.value.filter((li) => li.id !== id);
    await fetch("/api/shopping-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const getItemName = (itemId?: string) =>
    items.value.find((i) => i.id === itemId)?.name || "Unknown";

  return (
    <div class="space-y-6">
      <section>
        <h2 class="text-lg font-semibold mb-2">Search Catalog</h2>
        <div class="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onInput={(e) => (search.value = e.currentTarget.value)}
            class="flex-1 p-2 border rounded"
          />
        </div>
        <ul class="space-y-2">
          {filteredItems.value.map((item) => (
            <li key={item.id} class="flex items-center justify-between">
              <span>{item.name}</span>
              <button
                type="button"
                class="px-2 py-1 bg-blue-500 text-white rounded"
                onClick={() => item.id && addToList(item.id)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
        {filteredItems.value.length === 0 && search.value.trim().length > 0 && (
          <div class="mt-3 flex items-center gap-3">
            <span class="text-sm text-gray-600">
              No matches. Add to catalog?
            </span>
            <button
              type="button"
              class="px-2 py-1 bg-green-600 text-white rounded"
              onClick={addToCatalog}
            >
              Add "{search.value}"
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">My Shopping List</h2>
        <ul class="space-y-3">
          {list.value.map((li) => (
            <li key={li.id} class="p-3 border rounded">
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{getItemName(li.itemId)}</span>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={false}
                    onInput={() => removeListItem(li.id)}
                  />
                  <span>Done</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div class="flex items-center gap-2">
                  <label class="text-sm">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={li.quantity}
                    onInput={(e) =>
                      updateListItem(li.id, {
                        quantity: Number(e.currentTarget.value) || 1,
                      })
                    }
                    class="w-24 p-2 border rounded"
                  />
                </div>
                <div class="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Add a note (optional)"
                    value={li.note || ""}
                    onInput={(e) =>
                      updateListItem(li.id, { note: e.currentTarget.value })
                    }
                    class="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
