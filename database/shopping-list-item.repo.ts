import type {
  BulkAddItemInput,
  BulkAddResult,
  ShoppingListItemInterface,
} from "@/models/index.ts";
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
    await kv.delete(["shopping_list_items_rev", listId]);
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

  // Put many items on a list at once (the weekly-menu "Add to shopping list"
  // action):
  //   - no entry for the item      → create it (quantity 1, unchecked, note)
  //   - unchecked entry exists     → skip; fill its note only if empty
  //   - checked entry exists       → uncheck it ("restored"); fill note if empty
  // Never overwrites a written note, never bumps quantity. Concurrency safety
  // (so two people tapping at once cannot double-add) is handled by the
  // revision CAS below, not by the atomic commit alone.
  static async bulkAdd(
    listId: string,
    inputs: BulkAddItemInput[],
  ): Promise<BulkAddResult> {
    const kv = await getKv();
    // Serialise concurrent bulk adds on one list: every bulkAdd reads this
    // revision key and commits only if it is unchanged, bumping it in the
    // same atomic. A loser retries against the fresh entry set, so two
    // people tapping "Add to shopping list" at once cannot double-add.
    // (A single add() from the add-items screen does not take part; that
    // screen already hides items which are on the list.)
    const revKey = ["shopping_list_items_rev", listId];
    for (let attempt = 0; attempt < 8; attempt++) {
      const rev = await kv.get<number>(revKey);
      const existing = await this.getAll(listId);
      // One entry per item; when the list holds duplicates, an unchecked
      // entry is the one that represents "still to buy".
      const byItem = new Map<string, ShoppingListItemInterface>();
      for (const li of existing) {
        const cur = byItem.get(li.itemId);
        if (!cur || (cur.checked && !li.checked)) byItem.set(li.itemId, li);
      }

      const result: BulkAddResult = { added: [], restored: [], skipped: [] };
      const seen = new Set<string>();
      let atomic = kv.atomic();
      let writes = 0;

      for (const input of inputs) {
        if (seen.has(input.itemId)) continue;
        seen.add(input.itemId);
        const cur = byItem.get(input.itemId);
        const incomingNote = input.note?.trim() || undefined;

        if (!cur) {
          const entry: ShoppingListItemInterface = {
            id: crypto.randomUUID(),
            listId,
            itemId: input.itemId,
            quantity: 1,
            checked: false,
            ...(incomingNote ? { note: incomingNote } : {}),
          };
          atomic = atomic.set(
            ["shopping_list_items", listId, entry.id],
            entry,
          );
          writes++;
          result.added.push(entry);
          continue;
        }

        const note = cur.note?.trim() ? cur.note : incomingNote;
        const next: ShoppingListItemInterface = {
          ...cur,
          checked: false,
          ...(note ? { note } : {}),
        };
        if (cur.checked) result.restored.push(next);
        else result.skipped.push(cur.itemId);
        if (next.checked !== cur.checked || next.note !== cur.note) {
          atomic = atomic.set(["shopping_list_items", listId, cur.id], next);
          writes++;
        }
      }

      if (writes === 0) return result; // nothing to write, nothing to guard
      const { ok } = await atomic
        .check({ key: revKey, versionstamp: rev.versionstamp })
        .set(revKey, (rev.value ?? 0) + 1)
        .commit();
      if (ok) return result;
      // lost the race — loop and recompute against the new entry set
    }
    throw new Error("ShoppingListItemRepo.bulkAdd: conflict after retries");
  }
}
