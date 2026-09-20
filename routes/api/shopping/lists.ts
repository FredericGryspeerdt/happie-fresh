import { ShoppingListRepo } from "@/database/index.ts";
import { badRequest, define, json } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const lists = await ShoppingListRepo.getAll(householdId);
    return json(lists);
  },

  async POST(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { name } = await ctx.req.json();
    if (!name?.trim()) return badRequest("name required");
    const list = await ShoppingListRepo.create({
      householdId,
      name: name.trim(),
      createdBy: actingMember.id,
      createdAt: new Date().toISOString(),
    });
    return json(list, 201);
  },
});
