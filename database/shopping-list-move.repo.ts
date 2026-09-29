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
        `Kies 1–${MAX_MOVE_ITEMS} producten en een andere lijst, of een nieuwe lijstnaam (maximaal 100 tekens).`,
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
      ) {
        return fail(
          "Deze verplaatsing is verlopen. Vernieuw de lijst en probeer opnieuw.",
        );
      }
      if (receipt.value.undone) {
        return fail(
          "Deze verplaatsing is al ongedaan gemaakt. Vernieuw de lijst voordat je opnieuw verplaatst.",
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
      return fail("Een van deze lijsten is niet meer beschikbaar.");
    }
    const target: ShoppingListInterface = destination.value ?? {
      id: destinationId,
      householdId,
      name: input.newListName!.trim(),
      createdBy: memberId,
      createdAt: new Date().toISOString(),
    };
    const revisions = await kv.getMany<[number, number]>([
      ["shopping_list_items_rev", sourceId],
      ["shopping_list_items_rev", destination.value?.id ?? target.id],
    ]);
    const entries = await Promise.all(
      input.itemIds.map((id) =>
        kv.get<ShoppingListItemInterface>(itemKey(sourceId, id))
      ),
    );
    if (entries.some((e) => !e.value || e.value.listId !== sourceId)) {
      return fail(
        "Sommige geselecteerde producten zijn gewijzigd. Vernieuw de lijst en probeer opnieuw.",
      );
    }
    // Stay comfortably under KV's 800 KiB transaction limit, including overhead.
    if (
      new TextEncoder().encode(JSON.stringify(entries.map((e) => e.value)))
        .byteLength > 600_000
    ) {
      return fail(
        "Deze producten bevatten te veel tekst om samen te verplaatsen. Selecteer minder producten.",
      );
    }
    let atomic = kv.atomic().check(source, destination, receipt, ...revisions);
    for (const revision of revisions) {
      atomic = atomic.set(revision.key, (revision.value ?? 0) + 1);
    }
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
      return fail(
        "De lijsten zijn gewijzigd tijdens het verplaatsen. Probeer opnieuw.",
      );
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
        "Ongedaan maken is niet meer mogelijk. Je kunt de producten terugplaatsen vanuit hun nieuwe lijst.",
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
      return fail(
        "Een lijst is verwijderd. Deze verplaatsing kan niet ongedaan gemaakt worden.",
      );
    }
    const revisions = await kv.getMany<[number, number]>([
      ["shopping_list_items_rev", sourceId],
      ["shopping_list_items_rev", record.result.destination.id],
    ]);
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
        "Deze producten zijn gewijzigd na de verplaatsing. Plaats ze terug vanuit hun nieuwe lijst.",
      );
    }
    let atomic = kv.atomic().check(source, destination, receipt, ...revisions);
    for (const revision of revisions) {
      atomic = atomic.set(revision.key, (revision.value ?? 0) + 1);
    }
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
      return fail(
        "De lijsten zijn gewijzigd tijdens het ongedaan maken. Probeer opnieuw.",
      );
    }
    return {
      ok: true,
      count: record.result.count,
      items: entries.map((e) => ({ ...e.value!, listId: sourceId })),
    };
  }
}
