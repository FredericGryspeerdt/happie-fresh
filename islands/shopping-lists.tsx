import { signal } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";
import { ShoppingListInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";

interface ShoppingListsProps {
  initialLists: ShoppingListInterface[];
}

export default function ShoppingLists(
  { initialLists }: ShoppingListsProps,
) {
  const lists = signal<ShoppingListInterface[]>(initialLists);
  const newName = signal("");
  const editingId = signal<string | null>(null);
  const editName = signal("");
  const loading = signal(false);

  const createList = async () => {
    const name = newName.value.trim();
    if (!name) return;
    loading.value = true;
    try {
      const created = await api.shoppingLists.create(name);
      if (created) {
        lists.value = [...lists.value, created];
        newName.value = "";
      }
    } finally {
      loading.value = false;
    }
  };

  const startRename = (list: ShoppingListInterface) => {
    editingId.value = list.id;
    editName.value = list.name;
  };

  const confirmRename = async (id: string) => {
    const name = editName.value.trim();
    if (!name) return;
    const updated = await api.shoppingLists.rename(id, name);
    if (updated) {
      lists.value = lists.value.map((l) => l.id === id ? updated : l);
    }
    editingId.value = null;
  };

  const deleteList = async (id: string) => {
    await api.shoppingLists.delete(id);
    lists.value = lists.value.filter((l) => l.id !== id);
  };

  return (
    <div class="space-y-4">
      <Show
        when={() => lists.value.length > 0}
        fallback={
          <p class="text-gray-500 text-center py-8">
            No shopping lists yet. Create your first one below.
          </p>
        }
      >
        <ul class="space-y-2">
          <For each={lists}>
            {(list) => (
              <li
                key={list.id}
                class="flex items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl shadow-sm"
              >
                <Show
                  when={() => editingId.value === list.id}
                  fallback={
                    <>
                      <a
                        href={`/lists/${list.id}`}
                        class="flex-1 font-medium text-gray-800 text-lg"
                      >
                        {list.name}
                      </a>
                      <button
                        type="button"
                        class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => startRename(list)}
                        aria-label={`Rename ${list.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => deleteList(list.id)}
                        aria-label={`Delete ${list.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </>
                  }
                >
                  <input
                    type="text"
                    class="flex-1 border border-blue-300 rounded-lg px-3 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editName.value}
                    onInput={(e) => editName.value = e.currentTarget.value}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(list.id);
                      if (e.key === "Escape") editingId.value = null;
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    class="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium"
                    onClick={() => confirmRename(list.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm"
                    onClick={() => editingId.value = null}
                  >
                    Cancel
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="flex gap-2">
        <input
          type="text"
          placeholder="New list name"
          class="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newName.value}
          onInput={(e) => newName.value = e.currentTarget.value}
          onKeyDown={(e) => e.key === "Enter" && createList()}
          disabled={loading.value}
        />
        <button
          type="button"
          class="px-5 py-3 bg-blue-500 text-white font-medium rounded-xl shadow-sm active:scale-95 transition-transform disabled:opacity-50"
          onClick={createList}
          disabled={loading.value}
        >
          Add
        </button>
      </div>
    </div>
  );
}
