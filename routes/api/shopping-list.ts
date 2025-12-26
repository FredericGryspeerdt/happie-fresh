import { Context } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";

interface State {
  userId?: string;
}

export const handler = {
  async GET(ctx: Context<State>) {
    const userId = ctx.state.userId;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const items = await ShoppingListRepo.getAll(userId);
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx: Context<State>) {
    const userId = ctx.state.userId;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const { itemId } = await ctx.req.json();
    if (!itemId) return new Response("itemId required", { status: 400 });
    const entry = await ShoppingListRepo.add(userId, itemId);
    return new Response(JSON.stringify(entry), { status: 201 });
  },

  async PATCH(ctx: Context<State>) {
    const userId = ctx.state.userId;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const { id, quantity, note, checked } = await ctx.req.json();
    console.log("[API] PATCH /api/shopping-list", {
      userId,
      id,
      quantity,
      note,
      checked,
    });
    if (!id) return new Response("id required", { status: 400 });
    const updated = await ShoppingListRepo.update(userId, id, {
      quantity,
      note,
      checked,
    });
    if (!updated) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(ctx: Context<State>) {
    const userId = ctx.state.userId;
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const { id } = await ctx.req.json();
    if (!id) return new Response("id required", { status: 400 });
    await ShoppingListRepo.delete(userId, id);
    return new Response(null, { status: 204 });
  },
};
