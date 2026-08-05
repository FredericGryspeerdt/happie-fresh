import type { TodoInterface } from "@/models/index.ts";

/**
 * All date reasoning for to-do due moments, kept pure and free of DOM, KV and
 * signals so the boundaries can be tested directly — they are the feature.
 *
 * Everything here reasons in the **local zone of the `now` it is handed**.
 * Grouping cannot be computed on the server, which does not know the viewer's
 * zone (see docs/adr/0004); the SSR loader and the island therefore call the
 * same functions with a different `now`, and can briefly disagree about which
 * group a boundary-adjacent to-do belongs to until hydration settles it.
 */

export type TodoGroupKey =
  | "overdue"
  | "today"
  | "thisWeek"
  | "later"
  | "noDate";

export interface TodoGroup {
  key: TodoGroupKey;
  todos: TodoInterface[];
}

export const GROUP_LABELS: Record<TodoGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  thisWeek: "This week",
  later: "Later",
  noDate: "No date",
};

/** Fixed render order — urgent first, undated last. */
const GROUP_ORDER: TodoGroupKey[] = [
  "overdue",
  "today",
  "thisWeek",
  "later",
  "noDate",
];

export function isOverdue(dueAt: string | null, now: Date): boolean {
  if (dueAt === null) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** Local midnight at the start of the day `d` falls on. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Local midnight ending the "this week" window: the end of the coming Sunday.
 * When `now` is itself a Sunday the window would collapse to nothing and push
 * Monday into `later` — wrong on the evening a household plans the week ahead —
 * so a Sunday extends to the end of the following Sunday.
 */
function endOfWeekWindow(now: Date): Date {
  const day = now.getDay(); // 0 = Sunday
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const start = startOfDay(now);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + daysUntilSunday + 1,
  );
}

function classify(todo: TodoInterface, now: Date): TodoGroupKey {
  if (todo.dueAt === null) return "noDate";
  if (isOverdue(todo.dueAt, now)) return "overdue";
  const due = new Date(todo.dueAt);

  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  if (due.getTime() < tomorrow.getTime()) return "today";
  if (due.getTime() < endOfWeekWindow(now).getTime()) return "thisWeek";
  return "later";
}

/**
 * Buckets already-ordered open to-dos by urgency. Preserves input order within
 * each group — `TodoRepo.getAll` emits dated-ascending then undated-newest
 * precisely so this single pass needs no sorting of its own — and omits groups
 * that end up empty.
 */
export function groupOpenTodos(
  todos: TodoInterface[],
  now: Date,
): TodoGroup[] {
  const buckets = new Map<TodoGroupKey, TodoInterface[]>();
  for (const todo of todos) {
    const key = classify(todo, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(todo);
    else buckets.set(key, [todo]);
  }

  return GROUP_ORDER
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, todos: buckets.get(key)! }));
}

/**
 * Total order for a household's to-dos — the exact ordering
 * `TodoRepo.getAll` stores its result in: open before done; within open,
 * dated before undated, dated soonest-first, undated newest-created-first;
 * within done, most recently done first. Every leaf ties break by
 * `id.localeCompare` for a stable, total order.
 *
 * Exported so `hooks/useTodos.ts` can re-sort after an optimistic patch that
 * changes a to-do's rank (`setDueAt`, `unTick`) without moving its array
 * position — the array position *is* the order (see `groupOpenTodos`'s
 * doc comment), so any mutation that doesn't preserve rank must re-sort with
 * this exact comparator or the list silently drifts out of order until the
 * next reload.
 */
export function compareTodos(a: TodoInterface, b: TodoInterface): number {
  const aOpen = a.completedAt === null;
  const bOpen = b.completedAt === null;

  // Open before done.
  if (aOpen !== bOpen) return aOpen ? -1 : 1;

  if (aOpen) {
    const aDated = a.dueAt !== null;
    const bDated = b.dueAt !== null;
    // Dated before undated.
    if (aDated !== bDated) return aDated ? -1 : 1;

    if (aDated) {
      // Soonest due first.
      if (a.dueAt !== b.dueAt) return a.dueAt! < b.dueAt! ? -1 : 1;
      return a.id.localeCompare(b.id);
    }

    // Undated: newest created first. Plain string comparison, not
    // localeCompare — two to-dos captured in the same rapid-capture burst
    // can share a millisecond-precision createdAt, so ties break by id for
    // a total, stable order; otherwise they'd fall back to KV iteration
    // order and could swap places relative to the optimistic prepend.
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  }

  // Both done: most recently done first.
  if (a.completedAt !== b.completedAt) {
    return a.completedAt! < b.completedAt! ? 1 : -1;
  }
  return a.id.localeCompare(b.id);
}

/**
 * The row label for a due moment, e.g. "Fri 1 Aug, 09:00". The time is always
 * included: once notifications exist it is when the phone will buzz, so hiding
 * it would be dishonest. The year is included only when it differs from `now`'s.
 * No explicit locale, so the device's is used and issue #13's Dutch conversion
 * is automatic.
 */
export function formatDueAt(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const date = due.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(due.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  const time = due.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/**
 * Parses a client-supplied due moment. Returns the canonical UTC string, `null`
 * to clear, or `undefined` when the value is unusable so the caller can 400.
 *
 * Canonicalising matters: `TodoRepo.getAll` compares `dueAt` as **strings**, so
 * an offset form like "2026-08-05T18:00:00+02:00" stored verbatim would sort
 * wrongly against "…Z" values. `<input type="datetime-local">` also yields a
 * zoneless local string, which the client converts before sending — this is the
 * server-side backstop for both.
 */
export function parseDueAt(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}
