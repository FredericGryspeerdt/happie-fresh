import { Context } from "fresh";
import { ShoppingListRepo } from "@/database/index.ts";

interface State {
  userId?: string;
  householdId?: string;
}

export const handler = {
  async GET(ctx: Context<State>) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const lists = await ShoppingListRepo.getAll(householdId);
    return new Response(JSON.stringify(lists), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx: Context<State>) {
    const userId = ctx.state.userId;
    const householdId = ctx.state.householdId;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { name } = await ctx.req.json();
    if (!name?.trim()) return new Response("name required", { status: 400 });
    const list = await ShoppingListRepo.create({
      householdId,
      name: name.trim(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });
    return new Response(JSON.stringify(list), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
};
