import { shoppingEntriesByItem } from "@/utils/shopping-list-entries.ts";
import {
  addShoppingAmounts,
  type ShoppingAmount,
} from "@/utils/shopping-amount.ts";
import { computed, type Signal, signal } from "@preact/signals";
import type {
  BulkAddItemInput,
  BulkAddOptions,
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

export type ShoppingStep = "idle" | "dishes" | "pick" | "preview";

export interface AddOutcome {
  // Entries created + entries restored (unchecked again).
  count: number;
  list: ShoppingListInterface;
}

// Drives "Add to shopping list" on the weekly menu. The target list is
// resolved without asking whenever it can be: exactly one list, or several
// lists with a remembered list that still exists; only otherwise does the
// picker dialog open (once — from then on the household's choice is
// remembered). Then: review the deduped ingredients, confirm one bulk write.
// `menu` is the live signal from useWeeklyMenu so the remembered list stays in
// sync. Instantiate once per island via useMemo (see CLAUDE.md).
export function useMenuShopping(
  menu: Signal<WeeklyMenuInterface>,
  dishes: DishInterface[],
  items: ItemInterface[],
) {
  const step = signal<ShoppingStep>("idle");
  const pendingSubmission = signal<
    {
      list: ShoppingListInterface;
      items: BulkAddItemInput[];
      options: BulkAddOptions;
    } | null
  >(null);
  const submissionMessage = signal<string | null>(null);
  const selectedDishes = signal(
    new Set(menu.value.entries.map((e) => e.dishId)),
  );
  const amounts = signal<Record<string, ShoppingAmount>>({});
  const previousAmounts = signal<Record<string, ShoppingAmount>>({});
  const reviewAmounts = computed(() => ({
    ...previousAmounts.value,
    ...amounts.value,
  }));
  const plannedDishes = computed(() =>
    dishes.filter((d) => menu.value.entries.some((e) => e.dishId === d.id))
  );
  let generation = 0;
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
    !unticked.value.has(row.itemId);
  const selectedCount = computed(() => rows.value.filter(isSelected).length);
  const draftLocked = computed(() =>
    adding.value || pendingSubmission.value !== null
  );
  const amountFor = (row: IngredientRow): ShoppingAmount =>
    reviewAmounts.value[row.itemId] ?? { quantity: 1, unit: "pieces" };
  const amountError = computed(() => {
    const row = rows.value.find((r) =>
      isSelected(r) && r.existingAmount &&
      !addShoppingAmounts(r.existingAmount, amountFor(r))
    );
    return row
      ? `Check the amount for ${row.name}: use a compatible unit and a total up to 99999.`
      : null;
  });

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

  const chooseList = async (list: ShoppingListInterface): Promise<boolean> => {
    if (loading.value || draftLocked.value) return false;
    const request = ++generation;
    const listItems = await withLoading(() =>
      api.shoppingList.getItemsOrNull(list.id)
    );
    if (request !== generation || listItems === null) return false;
    chosenList.value = list;
    const previous: Record<string, ShoppingAmount> = {};
    for (const entry of shoppingEntriesByItem(listItems).values()) {
      previous[entry.itemId] = {
        quantity: entry.checked ? entry.quantity : 1,
        unit: entry.unit ?? "pieces",
      };
    }
    previousAmounts.value = previous;
    const preview = collectIngredients(
      menu.value.entries.filter((e) => selectedDishes.value.has(e.dishId)),
      dishes,
      items,
      listItems,
    );
    rows.value = preview.rows;
    emptyDishes.value = preview.emptyDishes;
    step.value = "preview";
    // Remember the choice household-wide. Fire-and-forget: a failure here
    // costs nothing but next time's preselection. Rejected fetch is swallowed.
    if (menu.value.shoppingListId !== list.id) {
      void api.weeklyMenu.setShoppingList(list.id).then((m) => {
        if (m) menu.value = { ...menu.value, shoppingListId: m.shoppingListId };
      }).catch(() => {});
    }
    return true;
  };

  const start = async (): Promise<boolean> => {
    if (adding.value || loading.value) return false;
    if (pendingSubmission.value) {
      step.value = "preview";
      return true;
    }
    submissionMessage.value = null;
    const request = ++generation;
    const all = await withLoading(() => api.shoppingLists.getAllOrNull());
    if (request !== generation || all === null) return false;
    chosenList.value = null;
    rows.value = [];
    amounts.value = {};
    previousAmounts.value = {};
    emptyDishes.value = [];
    unticked.value = new Set();
    selectedDishes.value = new Set(plannedDishes.value.map((d) => d.id));
    lists.value = all;
    step.value = "dishes";
    return true;
  };

  const review = async (): Promise<boolean> => {
    if (loading.value || draftLocked.value || !selectedDishes.value.size) {
      return false;
    }
    const target = chosenList.value ??
      lists.value.find((l) => l.id === rememberedListId.value) ??
      (lists.value.length === 1 ? lists.value[0] : null);
    if (target) return await chooseList(target);
    step.value = "pick";
    return true;
  };
  const toggleDish = (id: string): void => {
    if (loading.value || draftLocked.value) return;
    const next = new Set(selectedDishes.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedDishes.value = next;
  };
  const back = (): void => {
    if (!loading.value && !draftLocked.value) step.value = "dishes";
  };
  const setAmount = (id: string, amount: ShoppingAmount): void => {
    if (!draftLocked.value) amounts.value = { ...amounts.value, [id]: amount };
  };

  const createList = async (name: string): Promise<boolean> => {
    if (loading.value || draftLocked.value) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    const request = ++generation;
    const created = await withLoading(() => api.shoppingLists.create(trimmed));
    if (!created || request !== generation) return false;
    lists.value = [...lists.value, created];
    return await chooseList(created);
  };

  const toggle = (itemId: string): void => {
    if (draftLocked.value || loading.value) return;
    const row = rows.value.find((r) => r.itemId === itemId);
    if (!row) return;
    const next = new Set(unticked.value);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    unticked.value = next;
  };

  const confirm = async (): Promise<AddOutcome | null> => {
    const list = chosenList.value;
    if (!list || adding.value || loading.value || selectedCount.value === 0) {
      return null;
    }
    if (!pendingSubmission.value && amountError.value) {
      submissionMessage.value = amountError.value;
      return null;
    }
    pendingSubmission.value ??= {
      list,
      items: rows.value.filter(isSelected).map((r) => ({
        itemId: r.itemId,
        note: noteFor(r),
        ...amountFor(r),
      })),
      options: { requestId: crypto.randomUUID(), addToExisting: true },
    };
    const submission = pendingSubmission.value;
    adding.value = true;
    submissionMessage.value = null;
    beginBusy();
    try {
      const result = await api.shoppingList.bulkAdd(
        submission.list.id,
        submission.items,
        submission.options,
      );
      if (!result) {
        submissionMessage.value =
          "We couldn't confirm the addition. Retry to check it safely; your amounts are kept unchanged.";
        return null;
      }
      if ("error" in result) {
        pendingSubmission.value = null;
        submissionMessage.value = result.error;
        // A definite rejection wrote nothing. Refresh totals so the member can
        // resolve a concurrent unit change while keeping their requested amounts.
        adding.value = false;
        await chooseList(submission.list);
        return null;
      }
      pendingSubmission.value = null;
      step.value = "idle";
      return {
        count: result.added.length + result.restored.length +
          (result.updated?.length ?? 0),
        list: submission.list,
      };
    } finally {
      adding.value = false;
      endBusy();
    }
  };

  // From "Change" the previous list and rows are still intact, so cancelling
  // the picker returns to the preview rather than dropping the whole flow.
  const changeList = (): void => {
    if (!draftLocked.value && !loading.value) step.value = "pick";
  };

  const cancel = (): void => {
    if (adding.value) return;
    generation++;
    step.value = (step.value === "pick" && chosenList.value !== null)
      ? "preview"
      : "idle";
  };

  return {
    step,
    // A destination change is an overlay on the existing review. The initial
    // list choice has no review to display yet.
    reviewOpen: computed(() =>
      step.value === "preview" ||
      (step.value === "pick" && chosenList.value !== null)
    ),
    draftLocked,
    submissionMessage,
    amountError,
    retrying: computed(() => pendingSubmission.value !== null),
    selectedDishes,
    plannedDishes,
    toggleDish,
    review,
    back,
    amounts,
    reviewAmounts,
    setAmount,
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
    changeList,
    createList,
    toggle,
    confirm,
    cancel,
  };
}
