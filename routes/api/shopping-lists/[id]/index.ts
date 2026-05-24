import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const id = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, id);
    if (!list) return new Response("Not found", { status: 404 });
    const { name } = await ctx.req.json();
    if (!name?.trim()) return new Response("name required", { status: 400 });
    const updated = await ShoppingListRepo.update(householdId, id, {
      name: name.trim(),
    });
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const id = ctx.params.id;
    const list = await ShoppingListRepo.getById(householdId, id);
    if (!list) return new Response("Not found", { status: 404 });
    await ShoppingListItemRepo.deleteAll(id);
    await ShoppingListRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
