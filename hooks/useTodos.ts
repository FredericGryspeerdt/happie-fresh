import { signal } from "@preact/signals";
import type { TodoInput, TodoInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";

type TodoEdit = { title?: string; notes?: string };

/** Exit-animation duration; kept in sync with the row transition in
 * TodoBacklog.tsx by importing this constant rather than hardcoding it twice. */
export const EXIT_MS = 300;

/**
 * Reactive store for a household's backlog. Follows the app's mutation
 * conventions: creates are **pessimistic** (the server mints the id, so we wait
 * for the returned to-do), edits are **optimistic and debounced**, and ticking
 * off and deleting are **optimistic with rollback**. The `api` boundary
 * reports failure by return value rather than throwing for non-ok responses
 * (a real transport failure — offline, etc. — can still reject; see #52), so
 * every mutation checks its return value and the island surfaces a snackbar.
 *
 * Call this inside `useMemo(() => useTodos(initial), [])` so the signals are
 * created once — see `islands/todos/TodoBacklog.tsx`.
 */
export function useTodos(initialTodos: TodoInterface[]) {
  const initial = initialTodos ?? [];
  // Two independent filters splitting on completedAt === null; getAll's
  // ordering (newest-created first, then most-recently-done first) is what
  // keeps each resulting list correctly ordered without sorting here.
  const openTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt === null),
  );
  const doneTodos = signal<TodoInterface[]>(
    initial.filter((t) => t.completedAt !== null),
  );
  const pendingCount = signal(0);
  /** Ids mid-exit-animation — the island fades these out (patterns doc §6). */
  const exitingIds = signal<string[]>([]);

  // Tracks the last non-blank title seen per to-do while it's being edited, so
  // a title left blank when the edit sheet closes can be restored instead of
  // rendering as an empty row until reload (spec hazard #1). Deliberately a
  // plain Map, not a signal — it's write-only bookkeeping consulted only by
  // flushTodo, so it doesn't need to drive a re-render itself.
  const lastNonEmptyTitle = new Map<string, string>();

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
      const next = { ...patch };
      // Never persist a blank title, but don't discard the rest of a merged
      // patch — notes edited in the same debounce window would otherwise be
      // silently lost. The sheet's title field can be emptied mid-typing, and
      // the last non-empty value is what the user meant.
      if (next.title !== undefined && !next.title.trim()) delete next.title;
      if (Object.keys(next).length === 0) return;
      startPending();
      try {
        await api.todos.update(id, next);
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
      list.map((t) => {
        if (t.id !== id) return t;
        if (t.title.trim()) lastNonEmptyTitle.set(id, t.title);
        return { ...t, ...patch };
      });
    if (openTodos.value.some((t) => t.id === id)) {
      openTodos.value = apply(openTodos.value);
    } else {
      doneTodos.value = apply(doneTodos.value);
    }
    scheduler.schedule(id, patch);
  };

  /** If the to-do's local title is currently blank, restore the last
   * non-empty value recorded for it (spec hazard #1: suppress the write while
   * blank *and* keep the last non-empty value when the sheet closes). */
  const restoreBlankTitle = (id: string): void => {
    const todo = findAnywhere(id);
    if (!todo || todo.title.trim()) return;
    const last = lastNonEmptyTitle.get(id);
    if (!last) return;
    const apply = (list: TodoInterface[]) =>
      list.map((t) => (t.id === id ? { ...t, title: last } : t));
    if (openTodos.value.some((t) => t.id === id)) {
      openTodos.value = apply(openTodos.value);
    } else {
      doneTodos.value = apply(doneTodos.value);
    }
  };

  /** Persist a pending edit immediately — call when the edit sheet closes. */
  const flushTodo = (id: string): void => {
    scheduler.flush(id);
    restoreBlankTitle(id);
  };

  /**
   * Set or clear a to-do's due moment. Optimistic with rollback and an
   * immediate PATCH — deliberately **not** debounced, because picking a date is
   * a discrete commit like ticking off, not incremental typing.
   *
   * No exit animation: the to-do stays open, it only moves between urgency
   * groups, and the island derives those from `openTodos`. Works on done to-dos
   * too, since the edit sheet opens for them.
   */
  const setDueAt = async (
    id: string,
    dueAt: string | null,
  ): Promise<boolean> => {
    const inOpen = openTodos.value.some((t) => t.id === id);
    const inDone = doneTodos.value.some((t) => t.id === id);
    if (!inOpen && !inDone) return false;

    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;
    const apply = (list: TodoInterface[]) =>
      list.map((t) => (t.id === id ? { ...t, dueAt } : t));

    if (inOpen) openTodos.value = apply(openTodos.value);
    else doneTodos.value = apply(doneTodos.value);

    startPending();
    try {
      const saved = await api.todos.update(id, { dueAt });
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

  const tickOff = async (id: string): Promise<boolean> => {
    // A second tap during the exit animation (ordinary on mobile) must not
    // start a second run — the row stays in openTodos for EXIT_MS on purpose,
    // so the plain openTodos guard below wouldn't catch it. Report success:
    // the first tickOff is already underway and will complete the operation.
    if (exitingIds.value.includes(id)) return true;
    if (!openTodos.value.some((t) => t.id === id)) return false;

    // §6: keep the row on screen for the transition, then move it.
    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    // Re-read after the wait — state may have changed during the animation
    // (an edit, or a refresh() replacing the list).
    const todo = openTodos.value.find((t) => t.id === id);
    if (!todo) {
      exitingIds.value = exitingIds.value.filter((x) => x !== id);
      return false;
    }

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
    // Same guard as tickOff — a second tap mid-exit-animation must not start
    // a second run; the first is already underway.
    if (exitingIds.value.includes(id)) return true;
    if (!findAnywhere(id)) return false;

    exitingIds.value = [...exitingIds.value, id];
    await new Promise((resolve) => setTimeout(resolve, EXIT_MS));

    const openSnapshot = openTodos.value;
    const doneSnapshot = doneTodos.value;

    // Drop any pending debounced edit first, or a late flush would PATCH a
    // to-do we just deleted (the hazard clearCheckedItems guards against in
    // hooks/useShoppingList.ts:195).
    scheduler.cancel(id);
    lastNonEmptyTitle.delete(id);
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
    setDueAt,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  };
}
