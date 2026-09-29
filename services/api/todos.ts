import type {
  TodoInput,
  TodoInterface,
  UpdateTodoDto,
} from "@/models/index.ts";
import { deleteResource } from "./delete-resource.ts";

export const todos = {
  /** A failed background read is unknown, never a zero badge. */
  getBadgeCount: async (before: Date): Promise<number | null> => {
    try {
      const query = new URLSearchParams({ before: before.toISOString() });
      const res = await fetch(`/api/todos/badge?${query}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const { count } = await res.json();
      return Number.isSafeInteger(count) && count >= 0 ? count : null;
    } catch {
      return null;
    }
  },
  getAll: async (): Promise<TodoInterface[]> => {
    const res = await fetch("/api/todos");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (input: TodoInput): Promise<TodoInterface | null> => {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    patch: UpdateTodoDto,
  ): Promise<TodoInterface | null> => {
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return res.json();
  },
  delete: async (id: string): Promise<boolean> =>
    await deleteResource(`/api/todos/${id}`),
};
