import { getKv } from "./db.ts";
import { ShoppingListItemInterface } from "@/models/index.ts";

export class ShoppingListRepo {
  static async add(
    userId: string,
    itemId: string,
  ): Promise<ShoppingListItemInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const entry: ShoppingListItemInterface = {
      id,
      userId,
      itemId,
      quantity: 1,
      checked: false,
    };
    await kv.set(["shopping_list", userId, id], entry);
    return entry;
  }

  static async getAll(userId: string): Promise<ShoppingListItemInterface[]> {
    const kv = await getKv();
    const iter = kv.list<ShoppingListItemInterface>({
      prefix: ["shopping_list", userId],
    });
    const items: ShoppingListItemInterface[] = [];
    for await (const { value } of iter) items.push(value);
    return items;
  }

  static async update(
    userId: string,
    id: string,
    patch: Partial<ShoppingListItemInterface>,
  ): Promise<ShoppingListItemInterface | null> {
    const kv = await getKv();
    const key = ["shopping_list", userId, id];
    const current = await kv.get<ShoppingListItemInterface>(key);
    if (!current.value) return null;
    const next = { ...current.value, ...patch } as ShoppingListItemInterface;
    await kv.set(key, next);
    return next;
  }

  static async delete(userId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["shopping_list", userId, id]);
  }
}
