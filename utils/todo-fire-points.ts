import type { TodoInterface } from "@/models/index.ts";

/**
 * Which fire-points are ready for the delivery sweep to act on.
 *
 * Pure and free of KV, cron and DOM for the same reason `utils/todo-due.ts` is:
 * the boundary rules are the part that can be wrong, so they need to be testable
 * on their own. Everything here compares instants — cron runs in UTC and `dueAt`
 * is an instant, so no timezone reasoning is involved (docs/adr/0004).
 */

/** How late a moment may be and still be worth sending. */
export const SEND_WINDOW_MS = 60 * 60 * 1000;

export interface DueFirePoint {
  todo: TodoInterface;
  /** `due@<ISO instant>` — the instant is part of the id so a reschedule re-fires. */
  firePointId: string;
  /**
   * false means the moment passed more than an hour ago: claim it, don't send it.
   * A notification about something due last Tuesday arriving now is noise, and
   * the to-do already reads as Overdue in the app.
   */
  withinWindow: boolean;
}

export function selectDueFirePoints(
  todos: TodoInterface[],
  now: Date,
): DueFirePoint[] {
  const nowMs = now.getTime();
  const out: DueFirePoint[] = [];

  for (const todo of todos) {
    if (todo.completedAt !== null) continue;
    if (todo.dueAt === null) continue;

    const dueMs = new Date(todo.dueAt).getTime();
    if (dueMs > nowMs) continue;

    out.push({
      todo,
      firePointId: `due@${todo.dueAt}`,
      withinWindow: nowMs - dueMs <= SEND_WINDOW_MS,
    });
  }

  return out;
}
