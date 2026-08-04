import type {
  CreateTodoDto,
  TodoInterface,
  UpdateTodoDto,
} from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

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
   * agree and the island only has to find the partition point: open to-dos
   * first (newest created first), then done ones (most recently done first).
   */
  static async getAll(householdId: string): Promise<TodoInterface[]> {
    const kv = await getKv();
    const iter = kv.list<TodoInterface>({ prefix: ["todos", householdId] });
    const todos: TodoInterface[] = [];
    for await (const { value } of iter) todos.push(value);

    return todos.sort((a, b) => {
      if (a.completedAt === null && b.completedAt === null) {
        // Plain string comparison, not localeCompare: two to-dos captured in
        // the same rapid-capture burst can share a millisecond-precision
        // createdAt, so ties are broken by id for a total, stable order —
        // otherwise they'd fall back to KV iteration order and could swap
        // places relative to the optimistic prepend on reload.
        if (a.createdAt !== b.createdAt) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.id.localeCompare(b.id);
      }
      if (a.completedAt === null) return -1;
      if (b.completedAt === null) return 1;
      if (a.completedAt !== b.completedAt) {
        return a.completedAt < b.completedAt ? 1 : -1;
      }
      return a.id.localeCompare(b.id);
    });
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<TodoInterface | null> {
    const kv = await getKv();
    const result = await kv.get<TodoInterface>(["todos", householdId, id]);
    return result.value;
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
    await kv.delete(["todos", householdId, id]);
  }
}
