import { ItemRepo } from "@/database/item.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const item = await ctx.req.json();
    if (item.id) {
      const existingItem = await ItemRepo.getById(householdId, item.id);
      if (!existingItem) {
        return new Response("Item not found", { status: 404 });
      }
      await ItemRepo.update(householdId, item.id, item);
      return new Response(JSON.stringify({ ...existingItem, ...item }), {
        status: 200,
      });
    }
    const saved = await ItemRepo.create(householdId, item);
    return new Response(JSON.stringify(saved), { status: 201 });
  },
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const items = await ItemRepo.readAll(householdId);
    return new Response(
      JSON.stringify(items),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { id } = await ctx.req.json();
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }
    await ItemRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
