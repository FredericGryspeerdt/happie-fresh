export interface TodoInterface {
  id: string;
  householdId: string;
  /** What needs doing, as the household typed it. */
  title: string;
  /** Optional detail — a phone number, a deadline someone mentioned. */
  notes?: string;
  /** userId of whoever added it. Creating requires a login, so this is a user. */
  createdBy: string;
  createdAt: string;
  /**
   * When the household actually did this, or null if it is still open. The
   * timestamp *is* the state — there is no separate `done` boolean. See
   * docs/adr/0002.
   */
  completedAt: string | null;
}

// Derived type for creation (no ID — the server mints it).
export type CreateTodoDto = Omit<TodoInterface, "id">;

/**
 * What the client sends to create a to-do. The server fills in `householdId`,
 * `createdBy`, `createdAt`, `completedAt` and `id` — the client never sends
 * (and cannot spoof) the household.
 */
export type TodoInput = Pick<TodoInterface, "title" | "notes">;

// Derived type for patch/update: never the id or householdId, everything else optional.
export type UpdateTodoDto = Partial<Omit<TodoInterface, "id" | "householdId">>;
