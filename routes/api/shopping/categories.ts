import { CategoryRepo } from "@/database/category.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const categories = await CategoryRepo.getAll(householdId);
    return new Response(
      JSON.stringify(categories),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { label } = await ctx.req.json();
    if (!label || typeof label !== "string" || label.trim() === "") {
      return new Response("Label is required", { status: 400 });
    }
    const category = await CategoryRepo.create(
      householdId,
      label.trim(),
      userId,
    );
    return new Response(JSON.stringify(category), { status: 201 });
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
        return new Response(null, { status: 204 });
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : "Reorder failed";
        return new Response(message, { status: 500 });
      }
    }
    const { id, label, order } = body;
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    const patch: Partial<{ label: string; order: number }> = {};
    if (label !== undefined) patch.label = label;
    if (order !== undefined) patch.order = order;
    const updated = await CategoryRepo.update(householdId, id, patch);
    if (!updated) {
      return new Response("Category not found", { status: 404 });
    }
    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { id } = await ctx.req.json();
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    await CategoryRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
