import { computed, signal } from "@preact/signals";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useCatalogue(
  initialItems: ItemInterface[],
  initialCategories: CategoryInterface[],
) {
  const items = signal<ItemInterface[]>(initialItems ?? []);
  const categories = signal<CategoryInterface[]>(initialCategories ?? []);
  const pendingCount = signal<number>(0);
  // Mirror each in-flight mutation into the global loading bar.
  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const sortedCategories = computed(() =>
    [...categories.value].sort((a, b) =>
      a.label.toLowerCase().localeCompare(b.label.toLowerCase())
    )
  );
  const categoryIdSet = computed(() =>
    new Set(categories.value.map((c) => c.id))
  );
  const itemNames = computed(() =>
    new Set(items.value.map((i) => i.name.trim().toLowerCase()))
  );
  const hasUncategorized = computed(() =>
    items.value.some((i) =>
      !i.categoryId || !categoryIdSet.value.has(i.categoryId)
    )
  );

  const itemsForCategory = (categoryId?: string): ItemInterface[] => {
    const ids = categoryIdSet.value;
    const list = categoryId
      ? items.value.filter((i) => i.categoryId === categoryId)
      : items.value.filter((i) => !i.categoryId || !ids.has(i.categoryId));
    return [...list].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  };

  const addItem = async (
    name: string,
    categoryId?: string,
  ): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    startPending();
    try {
      const created = await api.items.create({ name: trimmed, categoryId });
      if (created) {
        items.value = [...items.value, created];
        return created.id ?? null;
      }
      return null;
    } finally {
      endPending();
    }
  };

  const renameItem = async (id: string, name: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    const trimmed = name.trim();
    if (!existing || !trimmed) return;
    items.value = items.value.map((
      i,
    ) => (i.id === id ? { ...i, name: trimmed } : i));
    startPending();
    try {
      await api.items.update(id, trimmed, existing.categoryId);
    } finally {
      endPending();
    }
  };

  const moveItem = async (id: string, categoryId: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    if (!existing) return;
    items.value = items.value.map((
      i,
    ) => (i.id === id ? { ...i, categoryId } : i));
    startPending();
    try {
      await api.items.update(id, existing.name, categoryId);
    } finally {
      endPending();
    }
  };

  const removeItem = async (id: string): Promise<void> => {
    items.value = items.value.filter((i) => i.id !== id);
    startPending();
    try {
      await api.items.delete(id);
    } finally {
      endPending();
    }
  };

  const createCategory = async (
    label: string,
  ): Promise<CategoryInterface | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    startPending();
    try {
      const created = await api.categories.create(trimmed);
      if (created) {
        categories.value = [...categories.value, created];
        return created;
      }
      return null;
    } finally {
      endPending();
    }
  };

  const renameCategory = async (id: string, label: string): Promise<void> => {
    const trimmed = label.trim();
    if (!trimmed) return;
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, label: trimmed } : c
    );
    startPending();
    try {
      await api.categories.update(id, { label: trimmed });
    } finally {
      endPending();
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    categories.value = categories.value.filter((c) => c.id !== id);
    startPending();
    try {
      await api.categories.delete(id);
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const [newItems, newCategories] = await Promise.all([
        api.items.getAll(),
        api.categories.getAll(),
      ]);
      items.value = newItems;
      categories.value = newCategories;
    } finally {
      pendingCount.value--;
    }
  };

  return {
    items,
    categories,
    pendingCount,
    refresh,
    sortedCategories,
    itemNames,
    hasUncategorized,
    itemsForCategory,
    addItem,
    renameItem,
    moveItem,
    removeItem,
    createCategory,
    renameCategory,
    deleteCategory,
  };
}
