import { type Context } from "fresh";
import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";

export const handler = {
  async GET(_ctx: Context<unknown>) {
    await DishTagGroupRepo.ensureDefaults();
    const groups = await DishTagGroupRepo.getAll();
    return new Response(JSON.stringify(groups), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  async POST(_ctx: Context<unknown>) {
    const { groupId, label } = await _ctx.req.json();
    if (!groupId || !label?.trim()) {
      return new Response("groupId and label are required", { status: 400 });
    }
    const value = await DishTagGroupRepo.addValue(groupId, label.trim());
    if (!value) return new Response("Group not found", { status: 404 });
    return new Response(JSON.stringify(value), { status: 201 });
  },
};
