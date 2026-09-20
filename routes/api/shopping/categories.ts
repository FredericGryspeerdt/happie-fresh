import { CategoryRepo } from "@/database/category.repo.ts";
import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
} from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const categories = await CategoryRepo.getAll(householdId);
    return json(categories);
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { label } = await ctx.req.json();
    if (!label || typeof label !== "string" || label.trim() === "") {
      return badRequest("Label is required");
    }
    const category = await CategoryRepo.create(
      householdId,
      label.trim(),
      userId,
    );
    return json(category, 201);
  },

  async PATCH(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await ctx.req.json();
    if (Array.isArray(body)) {
      try {
        await CategoryRepo.reorder(householdId, body);
        return noContent();
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : "Reorder failed";
        return new Response(message, { status: 500 });
      }
    }
    const { id, label, order } = body;
    if (!id) {
      return badRequest("ID is required");
    }
    const patch: Partial<{ label: string; order: number }> = {};
    if (label !== undefined) patch.label = label;
    if (order !== undefined) patch.order = order;
    const updated = await CategoryRepo.update(householdId, id, patch);
    if (!updated) {
      return notFound("Category not found");
    }
    return json(updated);
  },

  async DELETE(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Deleting a category is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) {
      return badRequest("ID is required");
    }
    await CategoryRepo.delete(householdId, id);
    return noContent();
  },
});
