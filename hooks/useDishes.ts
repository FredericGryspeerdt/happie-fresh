import { computed, signal } from "@preact/signals";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useDishes(
  initialDishes: DishInterface[],
  initialTagGroups: DishTagGroupInterface[],
) {
  const dishes = signal<DishInterface[]>(initialDishes ?? []);
  const tagGroups = signal<DishTagGroupInterface[]>(initialTagGroups ?? []);
  const query = signal("");
  const selectedTagValueIds = signal<Set<string>>(new Set());
  const pendingCount = signal(0);

  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const filtered = computed<DishInterface[]>(() => {
    const q = query.value.trim().toLowerCase();
    const selected = selectedTagValueIds.value;

    // Map each selectable value id → its group id, then bucket the *selected*
    // ids by group so we can require a match within each active group (OR)
    // while requiring every active group to match (AND).
    const valueToGroup = new Map<string, string>();
    for (const g of tagGroups.value) {
      for (const v of g.values) valueToGroup.set(v.id, g.id);
    }
    const byGroup = new Map<string, Set<string>>();
    for (const vid of selected) {
      const gid = valueToGroup.get(vid);
      if (!gid) continue;
      if (!byGroup.has(gid)) byGroup.set(gid, new Set());
      byGroup.get(gid)!.add(vid);
    }

    return dishes.value
      .filter((d) => {
        if (q && !d.name.toLowerCase().includes(q)) return false;
        for (const [, valueIds] of byGroup) {
          if (!d.tagValueIds.some((t) => valueIds.has(t))) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  });

  const toggleTagValue = (valueId: string) => {
    const next = new Set(selectedTagValueIds.value);
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
    selectedTagValueIds.value = next;
  };

  const clearFilters = () => {
    selectedTagValueIds.value = new Set();
  };

  const removeDish = async (id: string): Promise<void> => {
    dishes.value = dishes.value.filter((d) => d.id !== id);
    startPending();
    try {
      await api.dishes.delete(id);
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const [d, g] = await Promise.all([
        api.dishes.getAll(),
        api.dishTagGroups.getAll(),
      ]);
      dishes.value = d;
      tagGroups.value = g;
    } finally {
      pendingCount.value--;
    }
  };

  return {
    dishes,
    tagGroups,
    query,
    selectedTagValueIds,
    pendingCount,
    filtered,
    toggleTagValue,
    clearFilters,
    removeDish,
    refresh,
  };
}
