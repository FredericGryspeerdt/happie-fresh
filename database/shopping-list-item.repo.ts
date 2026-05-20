import { ShoppingListItemInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

export class ShoppingListItemRepo {
  static async add(
    listId: string,
    itemId: string,
  ): Promise<ShoppingListItemInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const entry: ShoppingListItemInterface = {
      id,
      listId,
      itemId,
      quantity: 1,
      checked: false,
    };
    await kv.set(["shopping_list_items", listId, id], entry);
    return entry;
  }

  static async getAll(listId: string): Promise<ShoppingListItemInterface[]> {
    const kv = await getKv();
    const iter = kv.list<ShoppingListItemInterface>({
      prefix: ["shopping_list_items", listId],
    });
    const items: ShoppingListItemInterface[] = [];
    for await (const { value } of iter) items.push(value);
    return items;
  }

  static async update(
    listId: string,
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ): Promise<ShoppingListItemInterface | null> {
    const kv = await getKv();
    const key = ["shopping_list_items", listId, id];
    const current = await kv.get<ShoppingListItemInterface>(key);
    if (!current.value) return null;
    const next = { ...current.value, ...patch } as ShoppingListItemInterface;
    await kv.set(key, next);
    return next;
  }

  static async delete(listId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["shopping_list_items", listId, id]);
  }

  static async deleteAll(listId: string): Promise<void> {
    const kv = await getKv();
    for await (
      const entry of kv.list({ prefix: ["shopping_list_items", listId] })
    ) {
      await kv.delete(entry.key);
    }
  }
}
