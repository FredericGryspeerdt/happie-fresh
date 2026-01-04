import { ItemInterface, ShoppingListItemInterface, CategoryInterface } from "@/models/index.ts";

export const api = {
  items: {
    create: async (name: string, categoryId?: string): Promise<ItemInterface | null> => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, categoryId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
  },
  categories: {
    getAll: async (): Promise<CategoryInterface[]> => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  },
  shoppingList: {
    add: async (itemId: string): Promise<ShoppingListItemInterface | null> => {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    patch: async (
      id: string,
      patch: Partial<ShoppingListItemInterface>,
    ): Promise<void> => {
      await fetch("/api/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/shopping-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
};
