import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";
import { badRequest, define, json, notFound } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    await DishTagGroupRepo.ensureDefaults(householdId);
    const groups = await DishTagGroupRepo.getAll(householdId);
    return json(groups);
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { groupId, label } = await ctx.req.json();
    if (!groupId || !label?.trim()) {
      return badRequest("groupId and label are required");
    }
    const value = await DishTagGroupRepo.addValue(
      householdId,
      groupId,
      label.trim(),
    );
    if (!value) return notFound("Group not found");
    return json(value, 201);
  },
});
