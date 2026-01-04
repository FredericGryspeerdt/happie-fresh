import { CategoryInterface } from "@/models/index.ts";
import { For } from "@preact/signals/utils";
import { useCategoryManagement } from "@/hooks/index.ts";

interface CategoryManagementProps {
  categories: CategoryInterface[];
}

export default function CategoryManagement(
  { categories: initialCategories }: CategoryManagementProps,
) {
  const { editingId, editingLabel, newCategoryLabel, categories } = useCategoryManagement(initialCategories);

  const startEdit = (category: CategoryInterface) => {
    editingId.value = category.id!;
    editingLabel.value = category.label || "";
  };

  const cancelEdit = () => {
    editingId.value = null;
    editingLabel.value = "";
  };

  const saveEdit = async (id: string) => {
    if (!editingLabel.value.trim()) return;

    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label: editingLabel.value.trim() }),
    });

    if (res.ok) {
      const updated = await res.json();
      categories.value = categories.value.map((cat) =>
        cat.id === id ? updated : cat
      );
      cancelEdit();
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Items will become uncategorized.")) {
      return;
    }

    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      categories.value = categories.value.filter((cat) => cat.id !== id);
    }
  };

  const createCategory = async () => {
    if (!newCategoryLabel.value.trim()) return;

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newCategoryLabel.value.trim() }),
    });

    if (res.ok) {
      const created = await res.json();
      console.log("🚀 ~ createCategory ~ created:", created)
      categories.value = [...categories.value, created];
      newCategoryLabel.value = "";
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;

    const newOrder = [...categories.value];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];

    const updates = newOrder.map((cat, idx) => ({ id: cat.id!, order: idx }));

    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      categories.value = newOrder.map((cat, idx) => ({ ...cat, order: idx }));
    }
  };

  const moveDown = async (index: number) => {
    if (index === categories.value.length - 1) return;

    const newOrder = [...categories.value];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];

    const updates = newOrder.map((cat, idx) => ({ id: cat.id!, order: idx }));

    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      categories.value = newOrder.map((cat, idx) => ({ ...cat, order: idx }));
    }
  };

  return (
    <div class="space-y-6">
      {/* Add New Category */}
      <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h2 class="text-lg font-semibold mb-3">Add New Category</h2>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Category name..."
            value={newCategoryLabel}
            onInput={(e) => newCategoryLabel.value = e.currentTarget.value}
            onKeyDown={(e) => e.key === "Enter" && createCategory()}
            class="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createCategory}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* Category List */}
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm divide-y">
        <For
          each={categories}
          fallback={
            <div class="p-8 text-center text-gray-500">
              No categories yet. Add one above to get started.
            </div>
          }
        >
          {(category, index) => (
            <div class="p-4 flex items-center gap-3" key={category.id}>
              {/* Reorder Buttons */}
              <div class="flex flex-col gap-1">
                <button
                  onClick={() =>
                    moveUp(index)}
                  disabled={index === 0}
                  class="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() =>
                    moveDown(index)}
                  disabled={index === categories.value.length - 1}
                  class="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Category Label */}
              <div class="flex-1">
                {editingId.value === category.id
                  ? (
                    <input
                      type="text"
                      value={editingLabel.value}
                      onInput={(e) =>
                        editingLabel.value = e.currentTarget.value}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(category.id!);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      class="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  )
                  : <div class="font-medium">{category.label}</div>}
              </div>

              {/* Action Buttons */}
              <div class="flex gap-2">
                {editingId.value === category.id
                  ? (
                    <>
                      <button
                        onClick={() => saveEdit(category.id!)}
                        class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )
                  : (
                    <>
                      <button
                        onClick={() => startEdit(category)}
                        class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id!)}
                        class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
              </div>
            </div>
          )}
        </For>
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
