import { ItemRepo } from "@/database/item.repo.ts";
import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
} from "@/utils/index.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const item = await ctx.req.json();
    if (item.id) {
      const existingItem = await ItemRepo.getById(householdId, item.id);
      if (!existingItem) {
        return notFound("Item not found");
      }
      await ItemRepo.update(householdId, item.id, item);
      return json({ ...existingItem, ...item });
    }
    const saved = await ItemRepo.create(householdId, item);
    return json(saved, 201);
  },
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const items = await ItemRepo.readAll(householdId);
    return json(items);
  },
  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // Deleting a catalogue item is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) {
      return badRequest("ID is required");
    }
    await ItemRepo.delete(householdId, id);
    return noContent();
  },
});
