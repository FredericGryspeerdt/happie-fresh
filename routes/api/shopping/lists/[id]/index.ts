import { type Context } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
  type StateInterface,
} from "@/utils/index.ts";

async function authorizeList(
  ctx: Context<StateInterface>,
  listId: string,
) {
  const householdId = ctx.state.householdId;
  if (!householdId) return null;
  const list = await ShoppingListRepo.getById(householdId, listId);
  if (!list) return null;
  return list;
}

export const handler = define.handlers({
  async PATCH(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return notFound();
    const body = await ctx.req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Invalid patch");
    }
    const { name, showOnHome } = body;
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return badRequest("name required");
    }
    if (showOnHome !== undefined && typeof showOnHome !== "boolean") {
      return badRequest("showOnHome must be a boolean");
    }
    if (name === undefined && showOnHome === undefined) {
      return badRequest("Empty patch");
    }
    const updated = await ShoppingListRepo.update(
      ctx.state.householdId!,
      list.id,
      { name: name?.trim(), showOnHome },
    );
    return json(updated);
  },

  async DELETE(ctx) {
    // Deleting a whole list is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return notFound();
    // Close the list to atomic moves before enumerating children for cleanup.
    await ShoppingListRepo.delete(ctx.state.householdId!, list.id);
    await ShoppingListItemRepo.deleteAll(list.id);
    return noContent();
  },
});
