import { ItemRepo, ShoppingListItemRepo } from "@/database/index.ts";
import type { BulkAddItemInput } from "@/models/index.ts";
import { badRequest, define, json } from "@/utils/index.ts";
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
    const { itemId, note } = raw as { itemId?: unknown; note?: unknown };
    if (typeof itemId !== "string" || itemId.length === 0) return null;
    if (note !== undefined && typeof note !== "string") return null;
    out.push(note ? { itemId, note } : { itemId });
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
    // Ingredients whose catalogue item was deleted are dropped silently.
    const known = new Set(
      (await ItemRepo.readAll(list.householdId)).map((i) => i.id),
    );
    const result = await ShoppingListItemRepo.bulkAdd(
      list.id,
      items.filter((i) => known.has(i.itemId)),
    );
    return json(result, 201);
  },
});
