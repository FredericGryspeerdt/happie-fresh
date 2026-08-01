import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    await DishTagGroupRepo.ensureDefaults(householdId);
    const groups = await DishTagGroupRepo.getAll(householdId);
    return new Response(JSON.stringify(groups), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const { groupId, label } = await ctx.req.json();
    if (!groupId || !label?.trim()) {
      return new Response("groupId and label are required", { status: 400 });
    }
    const value = await DishTagGroupRepo.addValue(
      householdId,
      groupId,
      label.trim(),
    );
    if (!value) return new Response("Group not found", { status: 404 });
    return new Response(JSON.stringify(value), { status: 201 });
  },
});
