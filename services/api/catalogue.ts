import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import type { CreateItemDto } from "@/models/item/item.interface.ts";
import { deleteResource } from "./delete-resource.ts";

export const items = {
  create: async (item: CreateItemDto): Promise<ItemInterface | null> => {
    const res = await fetch("/api/shopping/catalogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) return null;
    return res.json();
  },
  getAll: async (): Promise<ItemInterface[]> => {
    const res = await fetch("/api/shopping/catalogue");
    if (!res.ok) return [];
    return res.json();
  },
  update: async (
    id: string,
    name: string,
    categoryId?: string,
  ): Promise<Required<ItemInterface> | null> => {
    const res = await fetch("/api/shopping/catalogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, categoryId }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  delete: async (id: string): Promise<boolean> =>
    await deleteResource("/api/shopping/catalogue", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
};

export const categories = {
  getAll: async (): Promise<CategoryInterface[]> => {
    const res = await fetch("/api/shopping/categories");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (label: string): Promise<CategoryInterface | null> => {
    const res = await fetch("/api/shopping/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    patch: { label?: string; order?: number },
  ): Promise<CategoryInterface | null> => {
    const res = await fetch("/api/shopping/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  reorder: async (
    updates: Array<{ id: string; order: number }>,
  ): Promise<void> => {
    await fetch("/api/shopping/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  },
  delete: async (id: string): Promise<boolean> =>
    await deleteResource("/api/shopping/categories", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
};
