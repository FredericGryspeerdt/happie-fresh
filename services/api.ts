import {
  CategoryInterface,
  ItemInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { CreateItemDto } from "@/models/item/item.interface.ts";

export const api = {
  items: {
    create: async (item: CreateItemDto): Promise<ItemInterface | null> => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) return null;
      return res.json();
    },
    getAll: async (): Promise<ItemInterface[]> => {
      const res = await fetch("/api/items");
      if (!res.ok) return [];
      return res.json();
    },
    update: async (
      id: string,
      name: string,
      categoryId?: string,
    ): Promise<Required<ItemInterface> | null> => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, categoryId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  categories: {
    getAll: async (): Promise<CategoryInterface[]> => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  },
  shoppingLists: {
    getAll: async (): Promise<ShoppingListInterface[]> => {
      const res = await fetch("/api/shopping-lists");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (name: string): Promise<ShoppingListInterface | null> => {
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    rename: async (
      id: string,
      name: string,
    ): Promise<ShoppingListInterface | null> => {
      const res = await fetch(`/api/shopping-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
    },
  },
  shoppingList: {
    getItems: async (listId: string): Promise<ShoppingListItemInterface[]> => {
      const res = await fetch(`/api/shopping-lists/${listId}/items`);
      if (!res.ok) return [];
      return res.json();
    },
    addItem: async (
      listId: string,
      itemId: string,
    ): Promise<ShoppingListItemInterface | null> => {
      const res = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    updateItem: async (
      listId: string,
      id: string,
      patch: Partial<ShoppingListItemInterface>,
    ): Promise<void> => {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
    },
    removeItem: async (listId: string, id: string): Promise<void> => {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
};
