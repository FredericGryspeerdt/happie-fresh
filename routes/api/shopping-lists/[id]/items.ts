import { Context } from "fresh";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";

interface State {
  householdId?: string;
}

async function authorizeList(ctx: Context<State>, listId: string) {
  const householdId = ctx.state.householdId;
  if (!householdId) return null;
  const list = await ShoppingListRepo.getById(householdId, listId);
  if (!list) return null;
  return list;
}

export const handler = {
  async GET(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const items = await ShoppingListItemRepo.getAll(list.id);
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { itemId } = await ctx.req.json();
    if (!itemId) return new Response("itemId required", { status: 400 });
    const entry = await ShoppingListItemRepo.add(list.id, itemId);
    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },

  async PATCH(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { id, quantity, note, checked } = await ctx.req.json();
    if (!id) return new Response("id required", { status: 400 });
    const updated = await ShoppingListItemRepo.update(list.id, id, {
      quantity,
      note,
      checked,
    });
    if (!updated) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async DELETE(ctx: Context<State>) {
    const list = await authorizeList(ctx, ctx.params.id);
    if (!list) return new Response("Forbidden", { status: 403 });
    const { id } = await ctx.req.json();
    if (!id) return new Response("id required", { status: 400 });
    await ShoppingListItemRepo.delete(list.id, id);
    return new Response(null, { status: 204 });
  },
};
