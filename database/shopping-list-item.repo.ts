import { ShoppingListItemInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

/** Merge a partial patch onto `current`, ignoring keys whose value is undefined,
 *  so a partial update never clobbers omitted fields. Defined falsy values
 *  (false, 0, "") still apply. */
export function mergeDefinedPatch<T extends object>(
  current: T,
  patch: Partial<T>,
): T {
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

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
    const next = mergeDefinedPatch(current.value, patch);
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
