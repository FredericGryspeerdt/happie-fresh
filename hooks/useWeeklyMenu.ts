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
  // back to the previous value on null/throw. Resolves false when rolled back,
  // so callers can tell the user that nothing was saved. Idempotent no-ops
  // (dedup add, removing an unplanned dish) count as success.
  const run = async (
    optimistic: WeeklyMenuInterface,
    call: () => Promise<WeeklyMenuInterface | null>,
  ): Promise<boolean> => {
    const prev = menu.value;
    menu.value = optimistic;
    pendingCount.value++;
    beginBusy();
    try {
      const result = await call();
      menu.value = result ?? prev;
      return result !== null;
    } catch {
      menu.value = prev;
      return false;
    } finally {
      pendingCount.value--;
      endBusy();
    }
  };

  const addDish = async (dishId: string): Promise<boolean> => {
    if (menu.value.entries.some((e) => e.dishId === dishId)) return true; // dedup
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: [...menu.value.entries, {
        id: `tmp-${dishId}`,
        dishId,
        day: null,
      }],
    };
    return await run(optimistic, () => api.weeklyMenu.addDish(dishId));
  };

  const removeEntry = async (entryId: string): Promise<boolean> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.filter((e) => e.id !== entryId),
    };
    return await run(optimistic, () => api.weeklyMenu.removeEntry(entryId));
  };

  const removeDishFromPlan = async (dishId: string): Promise<boolean> => {
    const entry = menu.value.entries.find((e) => e.dishId === dishId);
    return entry ? await removeEntry(entry.id) : true;
  };

  const setDay = async (
    entryId: string,
    day: Weekday | null,
  ): Promise<boolean> => {
    const optimistic: WeeklyMenuInterface = {
      ...menu.value,
      entries: menu.value.entries.map((
        e,
      ) => (e.id === entryId ? { ...e, day } : e)),
    };
    return await run(optimistic, () => api.weeklyMenu.setDay(entryId, day));
  };

  const clear = async (): Promise<boolean> => {
    return await run(
      { ...menu.value, entries: [] },
      () => api.weeklyMenu.clear(),
    );
  };

  // Re-add previously planned dishes (e.g. after a Clear) and re-pin their
  // weekdays. Resolves false if any step had to roll back.
  const restoreEntries = async (
    prev: MenuEntryInterface[],
  ): Promise<boolean> => {
    let ok = true;
    for (const e of prev) {
      if (!(await addDish(e.dishId))) ok = false;
      if (e.day) {
        const added = menu.value.entries.find((x) => x.dishId === e.dishId);
        if (!added || !(await setDay(added.id, e.day))) ok = false;
      }
    }
    return ok;
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
    restoreEntries,
    refresh,
  };
}
