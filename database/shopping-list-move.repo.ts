import type {
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import {
  MAX_MOVE_ITEMS,
  type MoveItemsInput,
  type MoveItemsResult,
  type UndoMoveResult,
} from "@/models/shopping-list/move.ts";
import { getKv } from "./db.ts";

interface Receipt {
  sourceId: string;
  input: MoveItemsInput;
  result: Extract<MoveItemsResult, { ok: true }>;
  expiresAt: number;
  undone: boolean;
}
const RECEIPT_LIFETIME = 10 * 60_000;
const itemKey = (
  listId: string,
  id: string,
) => ["shopping_list_items", listId, id];
const listKey = (
  householdId: string,
  id: string,
) => ["shopping_lists", householdId, id];
const fail = (error: string) => ({ ok: false as const, error });

/** Atomic, household-authorized transfers. Receipts and moved entries share the
 * commit versionstamp, letting undo detect every intervening edit or move. */
export class ShoppingListMoveRepo {
  static async move(
    householdId: string,
    memberId: string,
    sourceId: string,
    input: MoveItemsInput,
  ): Promise<MoveItemsResult> {
    if (
      !input || typeof input.requestId !== "string" ||
      !/^[\w-]{1,64}$/.test(input.requestId) ||
      !Array.isArray(input.itemIds) || input.itemIds.length < 1 ||
      input.itemIds.length > MAX_MOVE_ITEMS ||
      input.itemIds.some((id) =>
        typeof id !== "string" || !id || id.length > 128
      ) ||
      new Set(input.itemIds).size !== input.itemIds.length ||
      (typeof input.destinationListId === "string") ===
        (typeof input.newListName === "string") ||
      (input.newListName !== undefined &&
        (typeof input.newListName !== "string" || !input.newListName.trim() ||
          input.newListName.trim().length > 100)) ||
      (input.destinationListId !== undefined &&
        (typeof input.destinationListId !== "string" ||
          !input.destinationListId || input.destinationListId.length > 128 ||
          input.destinationListId === sourceId))
    ) {
      return fail(
        `Choose 1–${MAX_MOVE_ITEMS} items and a different list, or a new list name (up to 100 characters).`,
      );
    }
    const kv = await getKv();
    const receiptKey = ["shopping_list_moves", householdId, input.requestId];
    const receipt = await kv.get<Receipt>(receiptKey);
    if (receipt.value) {
      if (
        receipt.value.sourceId !== sourceId ||
        JSON.stringify(receipt.value.input) !== JSON.stringify(input) ||
        receipt.value.expiresAt < Date.now()
      ) return fail("This move has expired. Refresh the list and try again.");
      if (receipt.value.undone) {
        return fail(
          "This move was already undone. Refresh the list before moving again.",
        );
      }
      return receipt.value.result;
    }
    const source = await kv.get<ShoppingListInterface>(
      listKey(householdId, sourceId),
    );
    const destinationId = input.destinationListId ?? crypto.randomUUID();
    const destination = await kv.get<ShoppingListInterface>(
      listKey(householdId, destinationId),
    );
    if (!source.value || (input.destinationListId && !destination.value)) {
      return fail("One of these lists is no longer available.");
    }
    const target: ShoppingListInterface = destination.value ?? {
      id: destinationId,
      householdId,
      name: input.newListName!.trim(),
      createdBy: memberId,
      createdAt: new Date().toISOString(),
    };
    const entries = await Promise.all(
      input.itemIds.map((id) =>
        kv.get<ShoppingListItemInterface>(itemKey(sourceId, id))
      ),
    );
    if (entries.some((e) => !e.value || e.value.listId !== sourceId)) {
      return fail(
        "Some selected items have changed. Refresh the list and try again.",
      );
    }
    // Stay comfortably under KV's 800 KiB transaction limit, including overhead.
    if (
      new TextEncoder().encode(JSON.stringify(entries.map((e) => e.value)))
        .byteLength > 600_000
    ) {
      return fail(
        "These items contain too much text to move together. Select fewer items.",
      );
    }
    let atomic = kv.atomic().check(source, destination, receipt);
    if (!destination.value) atomic = atomic.set(destination.key, target);
    for (const entry of entries) {
      const key = itemKey(destinationId, entry.value!.id);
      atomic = atomic.check(entry, { key, versionstamp: null }).delete(
        entry.key,
      ).set(key, { ...entry.value!, listId: destinationId });
    }
    const result: Extract<MoveItemsResult, { ok: true }> = {
      ok: true,
      requestId: input.requestId,
      count: entries.length,
      destination: target,
    };
    const record: Receipt = {
      sourceId,
      input,
      result,
      expiresAt: Date.now() + RECEIPT_LIFETIME,
      undone: false,
    };
    const commit = await atomic.set(receiptKey, record, {
      expireIn: RECEIPT_LIFETIME,
    }).commit();
    if (!commit.ok) {
      // A simultaneous retry may have committed this exact request.
      const replay = await kv.get<Receipt>(receiptKey);
      if (
        replay.value && !replay.value.undone &&
        replay.value.sourceId === sourceId &&
        JSON.stringify(replay.value.input) === JSON.stringify(input)
      ) return replay.value.result;
      return fail("The lists changed while moving. Please try again.");
    }
    return result;
  }

  static async undo(
    householdId: string,
    sourceId: string,
    requestId: string,
  ): Promise<UndoMoveResult> {
    const kv = await getKv();
    const receipt = await kv.get<Receipt>([
      "shopping_list_moves",
      householdId,
      requestId,
    ]);
    const record = receipt.value;
    if (
      !record || record.sourceId !== sourceId || record.expiresAt < Date.now()
    ) {
      return fail(
        "Undo has expired. You can move the items back from their new list.",
      );
    }
    if (record.undone) {
      const restored = await Promise.all(
        record.input.itemIds.map((id) =>
          kv.get<ShoppingListItemInterface>(itemKey(sourceId, id))
        ),
      );
      return {
        ok: true,
        count: record.result.count,
        items: restored.flatMap((e) => e.value ? [e.value] : []),
      };
    }
    const source = await kv.get<ShoppingListInterface>(
      listKey(householdId, sourceId),
    );
    const destination = await kv.get<ShoppingListInterface>(
      listKey(householdId, record.result.destination.id),
    );
    if (!source.value || !destination.value) {
      return fail("A list was removed, so this move cannot be undone.");
    }
    const entries = await Promise.all(
      record.input.itemIds.map((id) =>
        kv.get<ShoppingListItemInterface>(
          itemKey(record.result.destination.id, id),
        )
      ),
    );
    if (
      entries.some((e) => !e.value || e.versionstamp !== receipt.versionstamp)
    ) {
      return fail(
        "These items changed after the move. Move them back from their new list instead.",
      );
    }
    let atomic = kv.atomic().check(source, destination, receipt);
    for (const entry of entries) {
      const key = itemKey(sourceId, entry.value!.id);
      atomic = atomic.check(entry, { key, versionstamp: null }).delete(
        entry.key,
      ).set(key, { ...entry.value!, listId: sourceId });
    }
    const commit = await atomic.set(receipt.key, { ...record, undone: true }, {
      expireIn: RECEIPT_LIFETIME,
    }).commit();
    if (!commit.ok) {
      const replay = await kv.get<Receipt>(receipt.key);
      if (replay.value?.undone) {
        return this.undo(householdId, sourceId, requestId);
      }
      return fail("The lists changed while undoing. Please try again.");
    }
    return {
      ok: true,
      count: record.result.count,
      items: entries.map((e) => ({ ...e.value!, listId: sourceId })),
    };
  }
}
