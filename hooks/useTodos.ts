import { signal } from "@preact/signals";
import type { TodoInput, TodoInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

type TodoEdit = { title?: string; notes?: string };

/**
 * Reactive store for a household's backlog. Follows the app's mutation
 * conventions: creates are **pessimistic** (the server mints the id, so we wait
 * for the returned to-do), edits are **optimistic and debounced**, and ticking
 * off and deleting are **optimistic with rollback**. The `api` boundary never
 * throws, so every mutation reports failure by return value and the island
 * surfaces a snackbar.
 *
 * Call this inside `useMemo(() => useTodos(initial), [])` so the signals are
 * created once — see `islands/todos/TodoBacklog.tsx`.
 */
export function useTodos(initialTodos: TodoInterface[]) {
  const initial = initialTodos ?? [];
  // TodoRepo.getAll already returns open before done, so this is a partition.
  const openTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt === null),
  );
  const doneTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt !== null),
  );
  const pendingCount = signal(0);
  /** Ids mid-exit-animation — the island fades these out (patterns doc §6). */
  const exitingIds = signal<string[]>([]);

  const EXIT_MS = 300; // keep in sync with the row transition in TodoBacklog.tsx

  const startPending = () => {
    pendingCount.value++;
    beginBusy();
  };
  const endPending = () => {
    pendingCount.value--;
    endBusy();
  };

  const findAnywhere = (id: string): TodoInterface | undefined =>
    openTodos.value.find((t) => t.id === id) ??
      doneTodos.value.find((t) => t.id === id);

  /** Debounced title/notes writes, merged per to-do (500ms default). */
  const scheduler = createDebouncedMergeScheduler<TodoEdit>({
    flush: async (id, patch) => {
      // Never persist a blank title — the sheet's field can be emptied
      // mid-typing, and the last non-empty value is what the user meant.
      if (patch.title !== undefined && !patch.title.trim()) return;
      startPending();
      try {
        await api.todos.update(id, patch);
      } finally {
        endPending();
      }
    },
  });

  const addTodo = async (input: TodoInput): Promise<TodoInterface | null> => {
    startPending();
    try {
      const created = await api.todos.create(input);
      if (created) openTodos.value = [created, ...openTodos.value];
      return created;
    } finally {
      endPending();
    }
  };

  /** Optimistic local edit; the write is debounced and merged. */
  const editTodo = (id: string, patch: TodoEdit): void => {
    const apply = (list: TodoInterface[]) =>
      list.map((t) => (t.id === id ? { ...t, ...patch } : t));
    if (openTodos.value.some((t) => t.id === id)) {
      openTodos.value = apply(openTodos.value);
    } else {
      doneTodos.value = apply(doneTodos.value);
    }
    scheduler.schedule(id, patch);
  };

  /** Persist a pending edit immediately — call when the edit sheet closes. */
  const flushTodo = (id: string): void => scheduler.flush(id);

  const tickOff = async (id: string): Promise<boolean> => {
    const todo = openTodos.value.find((t) => t.id === id);
    if (!todo) return false;

    // §6: keep the row on screen for the transition, then move it.
    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    // Snapshot after the wait — state may have changed during the animation.
    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const completedAt = new Date().toISOString();
    const ticked = { ...todo, completedAt };

    openTodos.value = openTodos.value.filter((t) => t.id !== id);
    doneTodos.value = [ticked, ...doneTodos.value];
    exitingIds.value = exitingIds.value.filter((x) => x !== id);

    // Deliberately does NOT cancel pending edits, unlike useShoppingList's
    // checkItem: a queued title patch still targets a live record, and both
    // patches go through mergeDefinedPatch, so neither clobbers the other.
    startPending();
    try {
      const saved = await api.todos.update(id, { completedAt });
      if (!saved) {
        openTodos.value = openSnapshot;
        doneTodos.value = doneSnapshot;
        return false;
      }
      return true;
    } finally {
      endPending();
    }
  };

  const unTick = async (id: string): Promise<boolean> => {
    const todo = doneTodos.value.find((t) => t.id === id);
    if (!todo) return false;
    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const reopened = { ...todo, completedAt: null };

    doneTodos.value = doneTodos.value.filter((t) => t.id !== id);
    openTodos.value = [reopened, ...openTodos.value];

    startPending();
    try {
      const saved = await api.todos.update(id, { completedAt: null });
      if (!saved) {
        openTodos.value = openSnapshot;
        doneTodos.value = doneSnapshot;
        return false;
      }
      return true;
    } finally {
      endPending();
    }
  };

  const removeTodo = async (id: string): Promise<boolean> => {
    if (!findAnywhere(id)) return false;

    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;

    // Drop any pending debounced edit first, or a late flush would PATCH a
    // to-do we just deleted (the hazard clearCheckedItems guards against in
    // hooks/useShoppingList.ts:195).
    scheduler.cancel(id);
    openTodos.value = openTodos.value.filter((t) => t.id !== id);
    doneTodos.value = doneTodos.value.filter((t) => t.id !== id);
    exitingIds.value = exitingIds.value.filter((x) => x !== id);

    startPending();
    try {
      const ok = await api.todos.delete(id);
      if (!ok) {
        openTodos.value = openSnapshot;
        doneTodos.value = doneSnapshot;
      }
      return ok;
    } finally {
      endPending();
    }
  };

  const refresh = async (): Promise<void> => {
    // Pull-to-refresh renders its own spinner, so this intentionally tracks
    // pendingCount without driving the global loading bar (beginBusy/endBusy).
    pendingCount.value++;
    try {
      const all = await api.todos.getAll();
      openTodos.value = all.filter((t) => t.completedAt === null);
      doneTodos.value = all.filter((t) => t.completedAt !== null);
    } finally {
      pendingCount.value--;
    }
  };

  return {
    openTodos,
    doneTodos,
    exitingIds,
    pendingCount,
    addTodo,
    editTodo,
    flushTodo,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  };
}
