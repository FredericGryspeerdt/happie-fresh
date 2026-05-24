import { ShoppingListRepo } from "@/database/index.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const lists = await ShoppingListRepo.getAll(householdId);
    return new Response(JSON.stringify(lists), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async POST(ctx) {
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
});
