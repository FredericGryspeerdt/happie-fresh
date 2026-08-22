import { DishRepo } from "@/database/dish.repo.ts";
import { define, requireManager } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const dishes = await DishRepo.getAll(householdId);
    return new Response(JSON.stringify(dishes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    if (body.id) {
      const updated = await DishRepo.update(householdId, body.id, body);
      if (!updated) return new Response("Dish not found", { status: 404 });
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    const created = await DishRepo.create(householdId, body);
    return new Response(JSON.stringify(created), { status: 201 });
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // Deleting a dish is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await DishRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
