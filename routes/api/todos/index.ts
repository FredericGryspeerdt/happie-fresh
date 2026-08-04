import { badRequest, define, json } from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await TodoRepo.getAll(householdId));
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await ctx.req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return badRequest("title required");
    const rawNotes = String(body.notes ?? "").trim();

    const todo = await TodoRepo.create({
      householdId,
      title,
      notes: rawNotes || undefined,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueAt: null,
    });
    return json(todo, 201);
  },
});
