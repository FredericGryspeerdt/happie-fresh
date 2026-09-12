import { shoppingEntriesByItem } from "@/utils/shopping-list-entries.ts";
import type {
  BulkAddItemInput,
  BulkAddOptions,
  BulkAddResult,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { addShoppingAmounts } from "@/utils/shopping-amount.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

export class ShoppingAmountConflict extends Error {}

interface BulkReceipt {
  fingerprint: string;
  chunks: number;
}

// Every writer participates so bulk snapshots need one revision check rather
// than a check per item (KV permits at most 100 checks per transaction).
async function mutateList<T>(
  listId: string,
  prepare: (
    kv: Deno.Kv,
    atomic: Deno.AtomicOperation,
  ) => Promise<{ atomic: Deno.AtomicOperation; result: T }>,
): Promise<T> {
  const kv = await getKv();
  const key = ["shopping_list_items_rev", listId];
  for (let attempt = 0; attempt < 8; attempt++) {
    const rev = await kv.get<number>(key);
    const { atomic, result } = await prepare(kv, kv.atomic());
    const { ok } = await atomic.check(rev).set(key, (rev.value ?? 0) + 1)
      .commit();
    if (ok) return result;
  }
  throw new Error("Shopping list changed repeatedly. Please try again.");
}

export class ShoppingListItemRepo {
  static async add(
    listId: string,
    itemId: string,
  ): Promise<ShoppingListItemInterface> {
    const id = crypto.randomUUID();
    const entry: ShoppingListItemInterface = {
      id,
      listId,
      itemId,
      quantity: 1,
      checked: false,
    };
    return await mutateList(listId, (_kv, atomic) =>
      Promise.resolve({
        atomic: atomic.set(["shopping_list_items", listId, id], entry),
        result: entry,
      }));
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
    const key = ["shopping_list_items", listId, id];
    return await mutateList(listId, async (kv, atomic) => {
      const current = await kv.get<ShoppingListItemInterface>(key);
      if (!current.value) return { atomic, result: null };
      const next = mergeDefinedPatch(current.value, patch);
      return { atomic: atomic.set(key, next), result: next };
    });
  }

  static async delete(listId: string, id: string): Promise<void> {
    await mutateList(listId, (_kv, atomic) =>
      Promise.resolve({
        atomic: atomic.delete(["shopping_list_items", listId, id]),
        result: undefined,
      }));
  }

  static async deleteAll(listId: string): Promise<void> {
    const kv = await getKv();
    for await (
      const entry of kv.list<ShoppingListItemInterface>({
        prefix: ["shopping_list_items", listId],
      })
    ) {
      await this.delete(listId, entry.value.id);
    }
    // List deletion is the only lifecycle event that removes durable receipts.
    for await (
      const entry of kv.list({ prefix: ["shopping_bulk_receipts", listId] })
    ) {
      await kv.delete(entry.key);
    }
    await kv.delete(["shopping_list_items_rev", listId]);
  }

  static async clearChecked(listId: string): Promise<number> {
    return await mutateList(listId, async (kv, atomic) => {
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
      return { atomic, result: count };
    });
  }

  // Legacy calls skip unchecked entries. Additive calls sum additional amounts
  // against the latest checked version and atomically record an immutable receipt.
  // Bought entries are restored with the requested amount, never accumulated.
  static async bulkAdd(
    listId: string,
    inputs: BulkAddItemInput[],
    options?: BulkAddOptions,
    knownItemIds?: ReadonlySet<string>,
  ): Promise<BulkAddResult> {
    const kv = await getKv();
    // Receipts intentionally have no TTL: expiring them could double-apply a
    // delayed retry. Chunk results to stay below KV's per-value size limit.
    const receiptKey = [
      "shopping_bulk_receipts",
      listId,
      options?.requestId ?? "",
    ];
    const fingerprint = options
      ? Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(inputs)),
          ),
        ),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("")
      : "";
    const revKey = ["shopping_list_items_rev", listId];
    for (let attempt = 0; attempt < 8; attempt++) {
      const receipt = options ? await kv.get<BulkReceipt>(receiptKey) : null;
      if (receipt?.value) {
        if (receipt.value.fingerprint !== fingerprint) {
          throw new ShoppingAmountConflict(
            "This request was already used for different amounts. Please review and try again.",
          );
        }
        let serialized = "";
        for (let index = 0; index < receipt.value.chunks; index++) {
          const chunk = await kv.get<string>([...receiptKey, index]);
          if (chunk.value === null) {
            throw new Error("Missing shopping request receipt");
          }
          serialized += chunk.value;
        }
        return JSON.parse(serialized) as BulkAddResult;
      }
      if (
        options && knownItemIds &&
        inputs.some((input) => !knownItemIds.has(input.itemId))
      ) {
        throw new ShoppingAmountConflict(
          "An ingredient is no longer in the catalogue. Review your ingredients and try again.",
        );
      }
      const rev = await kv.get<number>(revKey);
      const existing: ShoppingListItemInterface[] = [];
      for await (
        const entry of kv.list<ShoppingListItemInterface>({
          prefix: ["shopping_list_items", listId],
        })
      ) {
        existing.push(entry.value);
      }
      const byItem = shoppingEntriesByItem(existing);

      const result: BulkAddResult = { added: [], restored: [], skipped: [] };
      if (options) result.updated = [];
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
            quantity: input.quantity ?? 1,
            ...(input.unit ? { unit: input.unit } : {}),
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

        const amount = options && !cur.checked
          ? addShoppingAmounts(
            { quantity: cur.quantity, unit: cur.unit ?? "pieces" },
            { quantity: input.quantity ?? 1, unit: input.unit ?? "pieces" },
          )
          : null;
        if (options && !cur.checked && !amount) {
          throw new ShoppingAmountConflict(
            "These amounts cannot be combined. Choose matching units and a total no greater than 99999.",
          );
        }
        const note = cur.note?.trim() ? cur.note : incomingNote;
        const next: ShoppingListItemInterface = {
          ...cur,
          ...(amount ?? {}),
          ...(options && cur.checked
            ? { quantity: input.quantity ?? 1, unit: input.unit ?? "pieces" }
            : {}),
          ...(cur.checked && input.quantity !== undefined
            ? { quantity: input.quantity }
            : {}),
          ...(cur.checked && input.unit !== undefined
            ? { unit: input.unit }
            : {}),
          checked: false,
          ...(note ? { note } : {}),
        };
        if (cur.checked) result.restored.push(next);
        else if (options) result.updated!.push(next);
        else result.skipped.push(cur.itemId);
        if (
          next.checked !== cur.checked || next.note !== cur.note ||
          next.quantity !== cur.quantity || next.unit !== cur.unit
        ) {
          atomic = atomic.set(
            ["shopping_list_items", listId, cur.id],
            next,
          );
          writes++;
        }
      }

      if (receipt) {
        const serialized = JSON.stringify(result);
        const chunks = Math.ceil(serialized.length / 8000);
        atomic = atomic.check(receipt).set(receiptKey, { fingerprint, chunks });
        for (let index = 0; index < chunks; index++) {
          atomic = atomic.set(
            [...receiptKey, index],
            serialized.slice(index * 8000, (index + 1) * 8000),
          );
        }
      }
      if (writes === 0 && !options) return result; // nothing to write, nothing to guard
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
