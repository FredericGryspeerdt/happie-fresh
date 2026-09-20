import type {
  BulkAddItemInput,
  BulkAddOptions,
  BulkAddResult,
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import type {
  MoveItemsInput,
  MoveItemsResult,
  UndoMoveResult,
} from "@/models/shopping-list/move.ts";
import { deleteResource } from "./delete-resource.ts";

export const shoppingLists = {
  getAll: async (): Promise<ShoppingListInterface[]> => {
    const res = await fetch("/api/shopping/lists");
    if (!res.ok) return [];
    return res.json();
  },
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
  delete: async (id: string): Promise<boolean> =>
    await deleteResource(`/api/shopping/lists/${id}`),
};

const getItemsOrNull = async (
  listId: string,
): Promise<ShoppingListItemInterface[] | null> => {
  try {
    const res = await fetch(`/api/shopping/lists/${listId}/items`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};

export const shoppingList = {
  getItemsOrNull,
  getItems: async (listId: string): Promise<ShoppingListItemInterface[]> =>
    await getItemsOrNull(listId) ?? [],
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
  removeItem: async (listId: string, id: string): Promise<boolean> =>
    await deleteResource(`/api/shopping/lists/${listId}/items`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
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
      return null;
    } catch {
      return null;
    }
  },
};
