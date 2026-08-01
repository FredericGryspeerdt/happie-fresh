import { computed, signal } from "@preact/signals";
import type {
  MenuEntryInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

export function useWeeklyMenu(initialMenu: WeeklyMenuInterface) {
  const menu = signal<WeeklyMenuInterface>(initialMenu);
  const pendingCount = signal(0);

  const plannedDishIds = computed<Set<string>>(
    () => new Set(menu.value.entries.map((e) => e.dishId)),
  );

  const sortedEntries = computed<MenuEntryInterface[]>(() => {
    const rank = (d: Weekday | null) =>
      d === null ? WEEKDAY_ORDER.length : WEEKDAY_ORDER.indexOf(d);
    return menu.value.entries
      .map((e, i) => ({ e, i }))
      .sort((a, b) => rank(a.e.day) - rank(b.e.day) || a.i - b.i)
      .map(({ e }) => e);
  });

  // apply an optimistic value, call the API, reconcile with the result, or roll
  // back to the previous value on null/throw.
  const run = async (
    optimistic: WeeklyMenuInterface,
    call: () => Promise<WeeklyMenuInterface | null>,
  ): Promise<void> => {
    const prev = menu.value;
    menu.value = optimistic;
    pendingCount.value++;
    beginBusy();
    try {
      const result = await call();
      menu.value = result ?? prev;
    } catch {
      menu.value = prev;
    } finally {
      pendingCount.value--;
      endBusy();
    }
  };

  const addDish = async (dishId: string): Promise<void> => {
    if (menu.value.entries.some((e) => e.dishId === dishId)) return; // dedup
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: [...menu.value.entries, {
        id: `tmp-${dishId}`,
        dishId,
        day: null,
      }],
    };
    await run(optimistic, () => api.weeklyMenu.addDish(dishId));
  };

  const removeEntry = async (entryId: string): Promise<void> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.filter((e) => e.id !== entryId),
    };
    await run(optimistic, () => api.weeklyMenu.removeEntry(entryId));
  };

  const removeDishFromPlan = async (dishId: string): Promise<void> => {
    const entry = menu.value.entries.find((e) => e.dishId === dishId);
    if (entry) await removeEntry(entry.id);
  };

  const setDay = async (
    entryId: string,
    day: Weekday | null,
  ): Promise<void> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.map((
        e,
      ) => (e.id === entryId ? { ...e, day } : e)),
    };
    await run(optimistic, () => api.weeklyMenu.setDay(entryId, day));
  };

  const clear = async (): Promise<void> => {
    await run({ ...menu.value, entries: [] }, () => api.weeklyMenu.clear());
  };

  const refresh = async (): Promise<void> => {
    pendingCount.value++;
    try {
      const result = await api.weeklyMenu.get();
      if (result) menu.value = result;
    } finally {
      pendingCount.value--;
    }
  };

  return {
    menu,
    pendingCount,
    plannedDishIds,
    sortedEntries,
    addDish,
    removeEntry,
    removeDishFromPlan,
    setDay,
    clear,
    refresh,
  };
}
