import type {
  MoveItemsInput,
  MoveItemsResult,
  UndoMoveResult,
} from "@/models/shopping-list/move.ts";
import {
  BulkAddItemInput,
  BulkAddOptions,
  BulkAddResult,
  CategoryInterface,
  CreateDishDto,
  DishInterface,
  DishTagGroupInterface,
  DishTagValueInterface,
  ItemInterface,
  LoyaltyCardInput,
  LoyaltyCardInterface,
  MemberInput,
  MemberInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
  TodoInput,
  TodoInterface,
  UpdateMemberDto,
  UpdateTodoDto,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { CreateItemDto } from "@/models/item/item.interface.ts";

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
    // Like getAll, but distinguishes "no lists" from "request failed" — the
    // menu's list picker must never tell a household it has no lists because
    // the network blipped.
    getAllOrNull: async (): Promise<ShoppingListInterface[] | null> => {
      try {
        const res = await fetch("/api/shopping/lists");
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
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
    getItemsOrNull: async (
      listId: string,
    ): Promise<ShoppingListItemInterface[] | null> => {
      try {
        const res = await fetch(`/api/shopping/lists/${listId}/items`);
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
    // Compatibility for collection callers that intentionally treat failure
    // as empty. Review flows use the nullable method to preserve their draft.
    getItems: async (listId: string): Promise<ShoppingListItemInterface[]> =>
      await api.shoppingList.getItemsOrNull(listId) ?? [],
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
    ): Promise<ShoppingListItemInterface | null> => {
      try {
        const res = await fetch(`/api/shopping/lists/${listId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...patch, id }),
        });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
    moveItems: async (
      listId: string,
      input: MoveItemsInput,
    ): Promise<MoveItemsResult | null> => {
      try {
        const res = await fetch(`/api/shopping/lists/${listId}/move-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        return await res.json();
      } catch {
        return null;
      }
    },
    undoMove: async (
      listId: string,
      requestId: string,
    ): Promise<UndoMoveResult | null> => {
      try {
        const res = await fetch(`/api/shopping/lists/${listId}/move-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ undoRequestId: requestId }),
        });
        return await res.json();
      } catch {
        return null;
      }
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
    bulkAdd: async (
      listId: string,
      items: BulkAddItemInput[],
      options?: BulkAddOptions,
    ): Promise<BulkAddResult | { error: string } | null> => {
      try {
        const res = await fetch(`/api/shopping/lists/${listId}/items/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, ...options }),
        });
        if (res.ok) return await res.json();
        if ([400, 403, 404, 409].includes(res.status)) {
          const body = await res.json().catch(() => null);
          return {
            error: typeof body?.error === "string"
              ? body.error
              : "Couldn't add these amounts. Review the list and try again.",
          };
        }
        return null; // Outcome is uncertain; retry exactly the same operation.
      } catch {
        return null;
      }
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
  weeklyMenu: {
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
  },
};
