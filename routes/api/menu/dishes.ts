import { DishRepo } from "@/database/dish.repo.ts";
import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
} from "@/utils/index.ts";
import { hasValidIngredientAmounts } from "@/utils/dish-ingredient-amount.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const dishes = await DishRepo.getAll(householdId);
    return json(dishes);
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    const existing = body.id
      ? await DishRepo.getById(householdId, body.id)
      : null;
    if (body.id && !existing) return notFound("Dish not found");
    const ingredientIds = body.ingredientIds ?? existing?.ingredientIds ?? [];
    if (!hasValidIngredientAmounts(ingredientIds, body.ingredientAmounts)) {
      return badRequest("Ingredient amounts must use a valid amount and unit.");
    }
    if (body.id) {
      const updated = await DishRepo.update(householdId, body.id, body);
      if (!updated) return notFound("Dish not found");
      return json(updated);
    }
    const created = await DishRepo.create(householdId, body);
    return json(created, 201);
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // Deleting a dish is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) return badRequest("ID is required");
    await DishRepo.delete(householdId, id);
    return noContent();
  },
});
