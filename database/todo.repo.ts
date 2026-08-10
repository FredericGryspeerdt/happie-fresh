import type {
  CreateTodoDto,
  TodoInterface,
  UpdateTodoDto,
} from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";
import { TodoNotificationRepo } from "./todo-notification.repo.ts";
import { compareTodos } from "@/utils/todo-due.ts";

/**
 * `dueAt`, `assignedTo` and `completedBy` were each added after the first
 * to-dos were written, so older records lack the keys. Normalising here —
 * once, at the read boundary — keeps every consumer free of `?? null`
 * defensiveness. No migration is needed: the fields are additive and
 * optional in storage.
 */
function normalise(value: TodoInterface): TodoInterface {
  if (
    value.dueAt !== undefined && value.assignedTo !== undefined &&
    value.completedBy !== undefined
  ) return value;
  return {
    ...value,
    dueAt: value.dueAt ?? null,
    assignedTo: value.assignedTo ?? null,
    completedBy: value.completedBy ?? null,
  };
}

/**
 * To-dos are shared within a household. Keys are scoped by household so a
 * member only ever reads or writes their own household's to-dos
 * (`["todos", householdId, id]`), mirroring `LoyaltyCardRepo`. A household has
 * exactly one backlog — there is no to-do list aggregate (see docs/adr/0001).
 */
export class TodoRepo {
  static async create(data: CreateTodoDto): Promise<TodoInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const todo: TodoInterface = { ...data, id };
    await kv.set(["todos", data.householdId, id], todo);
    return todo;
  }

  /**
   * Every consumer gets the same order, so the SSR render and the hydrated view
   * agree and the island only has to bucket: open to-dos first — those with a
   * due moment ordered soonest-first, then undated ones newest-created first —
   * and finally done ones, most recently done first. The full ordering
   * semantics (and why they're what they are) live on `compareTodos` in
   * utils/todo-due.ts, which `hooks/useTodos.ts` also uses to re-sort after an
   * optimistic patch changes a to-do's rank — this method and that hook must
   * never disagree about order, hence the shared comparator.
   *
   * Dated-ascending-then-undated-newest is what lets `groupOpenTodos` in
   * utils/todo-due.ts bucket in a single pass without sorting: each urgency
   * group comes out ascending, and "No date" keeps the newest-first order that
   * makes quick capture feel responsive.
   */
  static async getAll(householdId: string): Promise<TodoInterface[]> {
    const kv = await getKv();
    const iter = kv.list<TodoInterface>({ prefix: ["todos", householdId] });
    const todos: TodoInterface[] = [];
    for await (const { value } of iter) todos.push(normalise(value));

    return todos.sort(compareTodos);
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<TodoInterface | null> {
    const kv = await getKv();
    const result = await kv.get<TodoInterface>(["todos", householdId, id]);
    return result.value === null ? null : normalise(result.value);
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateTodoDto,
  ): Promise<TodoInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<TodoInterface>(existing, patch);
    await kv.set(["todos", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    // Markers must not outlive their to-do: ids are never reused, so orphans
    // could never be reclaimed and would accumulate forever.
    await TodoNotificationRepo.deleteForTodo(householdId, id);
    await kv.delete(["todos", householdId, id]);
  }

  /**
   * A removed member's open to-dos return to "up for grabs" (spec: the work
   * still needs doing and must not be invisibly parked on a ghost). Done rows
   * keep their ids dangling by design. Called from the members DELETE handler.
   */
  static async unassignMember(
    householdId: string,
    memberId: string,
  ): Promise<number> {
    const kv = await getKv();
    let cleared = 0;
    for await (
      const entry of kv.list<TodoInterface>({ prefix: ["todos", householdId] })
    ) {
      const todo = entry.value;
      if (todo.assignedTo !== memberId || todo.completedAt !== null) continue;
      await kv.set(entry.key, { ...todo, assignedTo: null });
      cleared++;
    }
    return cleared;
  }
}
