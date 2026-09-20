import type {
  TodoInput,
  TodoInterface,
  UpdateTodoDto,
} from "@/models/index.ts";
import { deleteResource } from "./delete-resource.ts";

export const todos = {
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
