import { type Context } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
import { define, type StateInterface } from "@/utils/index.ts";

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
    if (!list) return new Response("Not found", { status: 404 });
    const { name } = await ctx.req.json();
    if (!name?.trim()) return new Response("name required", { status: 400 });
    const updated = await ShoppingListRepo.update(
      ctx.state.householdId!,
      list.id,
      { name: name.trim() },
    );
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async DELETE(ctx) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Not found", { status: 404 });
    await ShoppingListItemRepo.deleteAll(list.id);
    await ShoppingListRepo.delete(ctx.state.householdId!, list.id);
    return new Response(null, { status: 204 });
  },
});
