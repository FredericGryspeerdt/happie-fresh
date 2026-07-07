import { computed, signal } from "@preact/signals";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";

export function useCatalogue(
  initialItems: ItemInterface[],
  initialCategories: CategoryInterface[],
) {
  const items = signal<ItemInterface[]>(initialItems ?? []);
  const categories = signal<CategoryInterface[]>(initialCategories ?? []);
  const pendingCount = signal<number>(0);

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
    pendingCount.value++;
    try {
      const created = await api.items.create({ name: trimmed, categoryId });
      if (created) {
        items.value = [...items.value, created];
        return created.id ?? null;
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const renameItem = async (id: string, name: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    const trimmed = name.trim();
    if (!existing || !trimmed) return;
    items.value = items.value.map((
      i,
    ) => (i.id === id ? { ...i, name: trimmed } : i));
    pendingCount.value++;
    try {
      await api.items.update(id, trimmed, existing.categoryId);
    } finally {
      pendingCount.value--;
    }
  };

  const moveItem = async (id: string, categoryId: string): Promise<void> => {
    const existing = items.value.find((i) => i.id === id);
    if (!existing) return;
    items.value = items.value.map((
      i,
    ) => (i.id === id ? { ...i, categoryId } : i));
    pendingCount.value++;
    try {
      await api.items.update(id, existing.name, categoryId);
    } finally {
      pendingCount.value--;
    }
  };

  const removeItem = async (id: string): Promise<void> => {
    items.value = items.value.filter((i) => i.id !== id);
    pendingCount.value++;
    try {
      await api.items.delete(id);
    } finally {
      pendingCount.value--;
    }
  };

  const createCategory = async (
    label: string,
  ): Promise<CategoryInterface | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    pendingCount.value++;
    try {
      const created = await api.categories.create(trimmed);
      if (created) {
        categories.value = [...categories.value, created];
        return created;
      }
      return null;
    } finally {
      pendingCount.value--;
    }
  };

  const renameCategory = async (id: string, label: string): Promise<void> => {
    const trimmed = label.trim();
    if (!trimmed) return;
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, label: trimmed } : c
    );
    pendingCount.value++;
    try {
      await api.categories.update(id, { label: trimmed });
    } finally {
      pendingCount.value--;
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    categories.value = categories.value.filter((c) => c.id !== id);
    pendingCount.value++;
    try {
      await api.categories.delete(id);
    } finally {
      pendingCount.value--;
    }
  };

  return {
    items,
    categories,
    pendingCount,
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
