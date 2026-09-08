import { computed, type Signal, signal } from "@preact/signals";
import type {
  DishInterface,
  ItemInterface,
  ShoppingListInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";
import {
  collectIngredients,
  type IngredientRow,
  noteFor,
} from "@/utils/menu-ingredients.ts";

export type ShoppingStep = "idle" | "pick" | "preview";

export interface AddOutcome {
  // Entries created + entries restored (unchecked again).
  count: number;
  list: ShoppingListInterface;
}

// Drives "Add to shopping list" on the weekly menu: pick a list (skipped when
// there is exactly one), review the deduped ingredients, confirm one bulk
// write. `menu` is the live signal from useWeeklyMenu so the remembered list
// stays in sync. Instantiate once per island via useMemo (see CLAUDE.md).
export function useMenuShopping(
  menu: Signal<WeeklyMenuInterface>,
  dishes: DishInterface[],
  items: ItemInterface[],
) {
  const step = signal<ShoppingStep>("idle");
  const lists = signal<ShoppingListInterface[]>([]);
  const chosenList = signal<ShoppingListInterface | null>(null);
  const rows = signal<IngredientRow[]>([]);
  const emptyDishes = signal<DishInterface[]>([]);
  // Rows start ticked; we only track the ones the user unticked.
  const unticked = signal<Set<string>>(new Set());
  const loading = signal(false); // fetching lists / list items
  const adding = signal(false); // bulk write in flight

  const rememberedListId = computed<string | null>(
    () => menu.value.shoppingListId ?? null,
  );
  const isSelected = (row: IngredientRow): boolean =>
    row.state !== "on-list" && !unticked.value.has(row.itemId);
  const selectedCount = computed(() => rows.value.filter(isSelected).length);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    loading.value = true;
    beginBusy();
    try {
      return await fn();
    } finally {
      loading.value = false;
      endBusy();
    }
  };

  const chooseList = async (list: ShoppingListInterface): Promise<void> => {
    chosenList.value = list;
    const listItems = await withLoading(() =>
      api.shoppingList.getItems(list.id)
    );
    const preview = collectIngredients(
      menu.value.entries,
      dishes,
      items,
      listItems,
    );
    rows.value = preview.rows;
    emptyDishes.value = preview.emptyDishes;
    unticked.value = new Set();
    step.value = "preview";
    // Remember the choice household-wide. Fire-and-forget: a failure here
    // costs nothing but next time's preselection.
    if (menu.value.shoppingListId !== list.id) {
      void api.weeklyMenu.setShoppingList(list.id).then((m) => {
        if (m) menu.value = { ...menu.value, shoppingListId: m.shoppingListId };
      });
    }
  };

  const start = async (): Promise<void> => {
    const all = await withLoading(() => api.shoppingLists.getAll());
    lists.value = all;
    if (all.length === 1) return await chooseList(all[0]);
    step.value = "pick";
  };

  const createList = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const created = await withLoading(() => api.shoppingLists.create(trimmed));
    if (!created) return false;
    lists.value = [...lists.value, created];
    await chooseList(created);
    return true;
  };

  const toggle = (itemId: string): void => {
    const row = rows.value.find((r) => r.itemId === itemId);
    if (!row || row.state === "on-list") return;
    const next = new Set(unticked.value);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    unticked.value = next;
  };

  const confirm = async (): Promise<AddOutcome | null> => {
    const list = chosenList.value;
    if (!list) return null;
    const payload = rows.value.filter(isSelected).map((r) => ({
      itemId: r.itemId,
      note: noteFor(r),
    }));
    adding.value = true;
    beginBusy();
    try {
      const result = await api.shoppingList.bulkAdd(list.id, payload);
      if (!result) return null;
      step.value = "idle";
      return { count: result.added.length + result.restored.length, list };
    } finally {
      adding.value = false;
      endBusy();
    }
  };

  const cancel = (): void => {
    step.value = "idle";
  };

  return {
    step,
    lists,
    chosenList,
    rows,
    emptyDishes,
    loading,
    adding,
    rememberedListId,
    selectedCount,
    isSelected,
    start,
    chooseList,
    createList,
    toggle,
    confirm,
    cancel,
  };
}
