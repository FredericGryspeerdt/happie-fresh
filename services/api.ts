import {
  CategoryInterface,
  ItemInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { CreateItemDto } from "@/models/item/item.interface.ts";
import {
  CreateDishDto,
  DishInterface,
  DishTagGroupInterface,
  DishTagValueInterface,
} from "@/models/index.ts";
import { LoyaltyCardInput, LoyaltyCardInterface } from "@/models/index.ts";
import { TodoInput, TodoInterface, UpdateTodoDto } from "@/models/index.ts";
import {
  MemberInput,
  MemberInterface,
  UpdateMemberDto,
} from "@/models/index.ts";

export const api = {
  items: {
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
    delete: async (id: string): Promise<void> => {
      await fetch("/api/shopping/catalogue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  categories: {
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
    delete: async (id: string): Promise<void> => {
      await fetch("/api/shopping/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  shoppingLists: {
    getAll: async (): Promise<ShoppingListInterface[]> => {
      const res = await fetch("/api/shopping/lists");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (name: string): Promise<ShoppingListInterface | null> => {
      const res = await fetch("/api/shopping/lists", {
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
      const res = await fetch(`/api/shopping/lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch(`/api/shopping/lists/${id}`, { method: "DELETE" });
    },
  },
  shoppingList: {
    getItems: async (
      listId: string,
    ): Promise<ShoppingListItemInterface[]> => {
      const res = await fetch(`/api/shopping/lists/${listId}/items`);
      if (!res.ok) return [];
      return res.json();
    },
    addItem: async (
      listId: string,
      itemId: string,
    ): Promise<ShoppingListItemInterface | null> => {
      const res = await fetch(`/api/shopping/lists/${listId}/items`, {
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
      await fetch(`/api/shopping/lists/${listId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
    },
    removeItem: async (listId: string, id: string): Promise<void> => {
      await fetch(`/api/shopping/lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    clearChecked: async (listId: string): Promise<number | null> => {
      const res = await fetch(`/api/shopping/lists/${listId}/items/checked`, {
        method: "DELETE",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.cleared as number;
    },
  },
  dishes: {
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
    delete: async (id: string): Promise<void> => {
      await fetch("/api/menu/dishes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  cards: {
    getAll: async (): Promise<LoyaltyCardInterface[]> => {
      const res = await fetch("/api/cards");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (
      card: LoyaltyCardInput,
    ): Promise<LoyaltyCardInterface | null> => {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!res.ok) return null;
      return res.json();
    },
    update: async (
      id: string,
      card: LoyaltyCardInput,
    ): Promise<LoyaltyCardInterface | null> => {
      const res = await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...card }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      await fetch("/api/cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
  todos: {
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
    delete: async (id: string): Promise<boolean> => {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      return res.ok;
    },
  },
  dishTagGroups: {
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
  },
  members: {
    getAll: async (): Promise<MemberInterface[]> => {
      const res = await fetch("/api/members");
      if (!res.ok) return [];
      return res.json();
    },
    create: async (input: MemberInput): Promise<MemberInterface | null> => {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return res.json();
    },
    update: async (
      id: string,
      patch: UpdateMemberDto,
    ): Promise<MemberInterface | null> => {
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      return res.json();
    },
    remove: async (id: string): Promise<boolean> => {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
      return res.ok;
    },
    claim: async (id: string): Promise<boolean> => {
      const res = await fetch("/api/members/acting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: id }),
      });
      return res.ok;
    },
  },
};
