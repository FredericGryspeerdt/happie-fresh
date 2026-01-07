import { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { useSignal } from "@preact/signals";
import { api } from "@/services/api.ts";
import SearchBox from "./search-box.tsx";

interface ItemCatalogProps {
  items: ItemInterface[];
  categories: CategoryInterface[];
}

export default function ItemCatalog(
  { items: initialItems, categories: initialCategories }: ItemCatalogProps,
) {
  const items = useSignal<ItemInterface[]>(initialItems);
  const categories = useSignal<CategoryInterface[]>(initialCategories);
  const searchQuery = useSignal("");
  const newItemName = useSignal("");
  const newItemCategoryId = useSignal("");
  const editingId = useSignal<string | null>(null);
  const editingName = useSignal("");
  const editingCategoryId = useSignal("");

  const filteredItems = () => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return items.value;
    return items.value.filter((item) =>
      item.name?.toLowerCase().includes(query)
    );
  };

  const groupedItems = () => {
    const categoryMap = new Map(
      categories.value.map((cat) => [cat.id, cat]),
    );

    const groups = new Map<string | undefined, ItemInterface[]>();

    for (const item of filteredItems()) {
      const categoryId = item.categoryId;
      if (!groups.has(categoryId)) {
        groups.set(categoryId, []);
      }
      groups.get(categoryId)!.push(item);
    }

    const result: Array<
      { category: CategoryInterface | null; items: ItemInterface[] }
    > = [];

    const categorizedGroups = Array.from(groups.entries())
      .filter(([catId]) =>
        catId !== undefined && catId !== null && catId !== ""
      )
      .map(([catId, items]) => ({
        category: categoryMap.get(catId!) || null,
        items: items.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      }))
      .sort((a, b) => {
        const orderA = a.category?.order ?? 999;
        const orderB = b.category?.order ?? 999;
        return orderA - orderB;
      });

    result.push(...categorizedGroups);

    const uncategorized = groups.get(undefined) || groups.get("") || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        items: uncategorized.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        ),
      });
    }

    return result;
  };

  const createItem = async () => {
    if (!newItemName.value.trim()) return;

    const created = await api.items.create(
      newItemName.value.trim(),
      newItemCategoryId.value || undefined,
    );

    if (created) {
      items.value = [...items.value, created];
      newItemName.value = "";
      newItemCategoryId.value = "";
    }
  };

  const startEdit = (item: ItemInterface) => {
    editingId.value = item.id!;
    editingName.value = item.name || "";
    editingCategoryId.value = item.categoryId || "";
  };

  const cancelEdit = () => {
    editingId.value = null;
    editingName.value = "";
    editingCategoryId.value = "";
  };

  const saveEdit = async (id: string) => {
    if (!editingName.value.trim()) return;

    const updated = await api.items.update(
      id,
      editingName.value.trim(),
      editingCategoryId.value || undefined,
    );

    if (updated) {
      items.value = items.value.map((item) => item.id === id ? updated : item);
      cancelEdit();
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete item "${name}"? Shopping list entries will be preserved.`,
      )
    ) return;

    await api.items.delete(id);
    items.value = items.value.filter((item) => item.id !== id);
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return "";
    return categories.value.find((c) => c.id === categoryId)?.label || "";
  };

  return (
    <div class="space-y-6">
      {/* Search Bar */}
      <SearchBox
        query={searchQuery}
      />

      {/* Add New Item */}
      <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h2 class="text-lg font-semibold mb-3">Add New Item</h2>
        <div class="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Item name..."
            value={newItemName.value}
            onInput={(e) => newItemName.value = e.currentTarget.value}
            onKeyDown={(e) => e.key === "Enter" && createItem()}
            class="flex-1 min-w-[200px] p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newItemCategoryId.value}
            onChange={(e) => newItemCategoryId.value = e.currentTarget.value}
            class="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Uncategorized</option>
            {categories.value.map((cat: CategoryInterface) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={createItem}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-all"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Grouped Items List */}
      <div class="space-y-6">
        {groupedItems().map((group) => (
          <div
            key={group.category?.id || "uncategorized"}
            class="bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 class="font-bold text-gray-700">
                {group.category?.label || "Uncategorized"}{" "}
                ({group.items.length})
              </h3>
            </div>
            <div class="divide-y">
              {group.items.map((item: ItemInterface) => (
                <div
                  key={item.id}
                  class="p-4 hover:bg-gray-50 transition-colors"
                >
                  {editingId.value === item.id
                    ? (
                      <div class="flex gap-2 items-center flex-wrap">
                        <input
                          type="text"
                          value={editingName.value}
                          onInput={(e) =>
                            editingName.value = e.currentTarget.value}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item.id!);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          class="flex-1 min-w-[200px] p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <select
                          value={editingCategoryId.value}
                          onChange={(e) =>
                            editingCategoryId.value = e.currentTarget.value}
                          class="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Uncategorized</option>
                          {categories.value.map((cat: CategoryInterface) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id!)}
                          class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          class="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                    : (
                      <div class="flex justify-between items-center gap-4">
                        <div class="flex-1">
                          <div class="font-medium text-gray-900">
                            {item.name}
                          </div>
                          {item.categoryId && (
                            <div class="text-sm text-gray-500">
                              Category: {getCategoryName(item.categoryId)}
                            </div>
                          )}
                        </div>
                        <div class="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id!, item.name!)}
                            class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedItems().length === 0 && (
          <div class="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            {searchQuery.value
              ? "No items found matching your search."
              : "No items yet. Add one above to get started."}
          </div>
        )}
      </div>

      {/* Back Link */}
      <div class="text-center">
        <a
          href="/home"
          class="inline-block px-6 py-2 text-blue-600 hover:text-blue-700 hover:underline"
        >
          ← Back to Shopping List
        </a>
      </div>
    </div>
  );
}
