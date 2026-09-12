import { ItemRepo, ShoppingListItemRepo } from "@/database/index.ts";
import { ShoppingAmountConflict } from "@/database/shopping-list-item.repo.ts";
import type { BulkAddItemInput, BulkAddOptions } from "@/models/index.ts";
import { badRequest, define, json } from "@/utils/index.ts";
import {
  isShoppingUnit,
  parseShoppingAmount,
} from "@/utils/shopping-amount.ts";
import { authorizeList } from "@/utils/authorize-list.ts";

// Deno KV allows 1000 mutations per atomic commit; bulkAdd writes at most one
// per item, so 500 leaves comfortable headroom.
const MAX_ITEMS = 500;

function parseItems(body: unknown): BulkAddItemInput[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > MAX_ITEMS) return null;
  const out: BulkAddItemInput[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const { itemId, note, quantity, unit } = raw as {
      itemId?: unknown;
      note?: unknown;
      quantity?: unknown;
      unit?: unknown;
    };
    if (typeof itemId !== "string" || itemId.length === 0) return null;
    if (note !== undefined && typeof note !== "string") return null;
    if (unit !== undefined && !isShoppingUnit(unit)) return null;
    if (
      quantity !== undefined && (typeof quantity !== "number" ||
        !parseShoppingAmount(String(quantity), unit ?? "pieces"))
    ) return null;
    out.push({
      itemId,
      ...(note ? { note } : {}),
      ...(quantity !== undefined ? { quantity: quantity as number } : {}),
      ...(unit !== undefined ? { unit } : {}),
    });
  }
  return out;
}

export const handler = define.handlers({
  // Put many catalogue items on this list at once. Dedup/restore/note rules
  // are applied by ShoppingListItemRepo.bulkAdd in one atomic commit.
  async POST(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest("invalid JSON");
    }
    const items = parseItems(body);
    if (!items) return badRequest("items required");
    const { addToExisting, requestId } = body as {
      addToExisting?: unknown;
      requestId?: unknown;
    };
    let options: BulkAddOptions | undefined;
    if (addToExisting !== undefined || requestId !== undefined) {
      if (
        addToExisting !== true || typeof requestId !== "string" ||
        requestId.trim().length === 0 || requestId.length > 128
      ) {
        return badRequest(
          "addToExisting requires a requestId of 1 to 128 characters",
        );
      }
      options = { addToExisting: true, requestId };
    }
    // Legacy callers silently drop deleted catalogue items. Additive callers
    // preserve request identity and reject changed ingredients before mutation.
    const known = new Set(
      (await ItemRepo.readAll(list.householdId)).map((i) => i.id),
    );
    try {
      const result = await ShoppingListItemRepo.bulkAdd(
        list.id,
        options ? items : items.filter((i) => known.has(i.itemId)),
        options,
        known,
      );
      return json(result, 201);
    } catch (error) {
      if (error instanceof ShoppingAmountConflict) {
        return json({ error: error.message }, 409);
      }
      throw error;
    }
  },
});
