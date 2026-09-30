import { signal } from "@preact/signals";
import type { HomeData } from "@/services/home.ts";
import { api } from "@/services/api.ts";
import { useTodos } from "@/hooks/useTodos.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

/** One household snapshot. Generation checks keep background reads from undoing writes. */
export function useHome(initial: HomeData) {
  const data = signal(initial);
  const todos = useTodos(initial.todos);
  const saving = signal(false);
  const refreshing = signal(false);
  let revision = 0;
  let reads = 0;

  const refresh = async (): Promise<boolean> => {
    if (saving.value) return true;
    const generation = ++revision;
    reads++;
    refreshing.value = true;
    try {
      const fresh = await api.home.get();
      if (generation !== revision) return true;
      if (!fresh) return false;
      data.value = fresh;
      todos.openTodos.value = fresh.todos.filter((t) => t.completedAt === null);
      todos.doneTodos.value = fresh.todos.filter((t) => t.completedAt !== null);
      return true;
    } finally {
      reads--;
      refreshing.value = reads > 0;
    }
  };
  const selectList = async (
    id: string,
    showOnHome: boolean,
  ): Promise<boolean> => {
    if (saving.value) return false;
    const previous = data.value.lists.find((l) => l.id === id);
    if (!previous) return false;
    ++revision;
    saving.value = true;
    beginBusy();
    const update = (value: boolean | undefined) => {
      data.value = {
        ...data.value,
        lists: data.value.lists.map((l) =>
          l.id === id ? { ...l, showOnHome: value } : l
        ),
      };
    };
    update(showOnHome);
    try {
      const saved = await api.shoppingLists.setShowOnHome(id, showOnHome);
      if (!saved) {
        update(previous.showOnHome);
        return false;
      }
      update(saved.showOnHome);
      return true;
    } finally {
      saving.value = false;
      endBusy();
    }
  };
  const complete = async (id: string): Promise<boolean> => {
    if (saving.value) return false;
    ++revision;
    saving.value = true;
    const open = todos.openTodos.value;
    const done = todos.doneTodos.value;
    try {
      return await todos.tickOff(id);
    } catch {
      // The existing API may reject on transport errors rather than return null.
      todos.openTodos.value = open;
      todos.doneTodos.value = done;
      return false;
    } finally {
      saving.value = false;
    }
  };
  return { data, todos, saving, refreshing, refresh, selectList, complete };
}
