import { ShoppingListItemInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

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
    // A stale PATCH must never recreate an entry removed by a move/delete.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await kv.get<ShoppingListItemInterface>(key);
      if (!current.value) return null;
      const next = mergeDefinedPatch(current.value, patch);
      const result = await kv.atomic().check(current).set(key, next).commit();
      if (result.ok) return next;
    }
    return null;
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

  static async clearChecked(listId: string): Promise<number> {
    const kv = await getKv();
    let atomic = kv.atomic();
    let count = 0;
    for await (
      const entry of kv.list<ShoppingListItemInterface>({
        prefix: ["shopping_list_items", listId],
      })
    ) {
      if (entry.value.checked) {
        atomic = atomic.delete(entry.key);
        count++;
      }
    }
    if (count === 0) return 0;
    const { ok } = await atomic.commit();
    if (!ok) throw new Error("Failed to clear checked items.");
    return count;
  }
}
