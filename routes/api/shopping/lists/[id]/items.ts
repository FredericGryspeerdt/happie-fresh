import { ShoppingListItemRepo } from "@/database/index.ts";
import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
} from "@/utils/index.ts";
import {
  isShoppingUnit,
  parseShoppingAmount,
} from "@/utils/shopping-amount.ts";
import { authorizeList } from "@/utils/authorize-list.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const items = await ShoppingListItemRepo.getAll(list.id);
    return json(items);
  },

  async POST(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { itemId } = await ctx.req.json();
    if (!itemId) return badRequest("itemId required");
    const entry = await ShoppingListItemRepo.add(list.id, itemId);
    return json(entry, 201);
  },

  async PATCH(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest("invalid JSON");
    }
    if (!body || typeof body !== "object") return badRequest("invalid item");
    const { id, quantity, unit, note, checked } = body as Record<
      string,
      unknown
    >;
    if (typeof id !== "string" || !id) return badRequest("id required");
    if (unit !== undefined && !isShoppingUnit(unit)) {
      return badRequest("invalid unit");
    }
    if (
      quantity !== undefined && (typeof quantity !== "number" ||
        !parseShoppingAmount(String(quantity), unit ?? "pieces"))
    ) return badRequest("invalid quantity");
    if (note !== undefined && typeof note !== "string") {
      return badRequest("invalid note");
    }
    if (checked !== undefined && typeof checked !== "boolean") {
      return badRequest("invalid checked");
    }
    const updated = await ShoppingListItemRepo.update(list.id, id, {
      quantity: quantity as number | undefined,
      unit,
      note,
      checked,
    });
    if (!updated) return notFound();
    return json(updated);
  },

  async DELETE(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { id } = await ctx.req.json();
    if (!id) return badRequest("id required");
    await ShoppingListItemRepo.delete(list.id, id);
    return noContent();
  },
});
