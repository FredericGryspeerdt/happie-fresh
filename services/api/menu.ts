import type {
  CreateDishDto,
  DishInterface,
  DishTagGroupInterface,
  DishTagValueInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { deleteResource } from "./delete-resource.ts";

export const dishes = {
  getAll: async (): Promise<DishInterface[]> => {
    const res = await fetch("/api/menu/dishes");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (dish: CreateDishDto): Promise<DishInterface | null> => {
    const res = await fetch("/api/menu/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dish),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    patch: Partial<DishInterface>,
  ): Promise<DishInterface | null> => {
    const res = await fetch("/api/menu/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, id }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  delete: async (id: string): Promise<boolean> =>
    await deleteResource("/api/menu/dishes", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
};

export const dishTagGroups = {
  getAll: async (): Promise<DishTagGroupInterface[]> => {
    const res = await fetch("/api/menu/tag-groups");
    if (!res.ok) return [];
    return res.json();
  },
  addValue: async (
    groupId: string,
    label: string,
  ): Promise<DishTagValueInterface | null> => {
    const res = await fetch("/api/menu/tag-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, label }),
    });
    if (!res.ok) return null;
    return res.json();
  },
};

export const weeklyMenu = {
  get: async (): Promise<WeeklyMenuInterface | null> => {
    const res = await fetch("/api/menu/plan");
    if (!res.ok) return null;
    return res.json();
  },
  addDish: async (dishId: string): Promise<WeeklyMenuInterface | null> => {
    const res = await fetch("/api/menu/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  setDay: async (
    entryId: string,
    day: Weekday | null,
  ): Promise<WeeklyMenuInterface | null> => {
    const res = await fetch("/api/menu/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, day }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  removeEntry: async (
    entryId: string,
  ): Promise<WeeklyMenuInterface | null> => {
    const res = await fetch("/api/menu/plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  clear: async (): Promise<WeeklyMenuInterface | null> => {
    const res = await fetch("/api/menu/plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  setShoppingList: async (
    shoppingListId: string,
  ): Promise<WeeklyMenuInterface | null> => {
    try {
      const res = await fetch("/api/menu/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shoppingListId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};
