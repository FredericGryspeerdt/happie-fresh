import { badRequest, define, json } from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";
import { parseDueAt } from "@/utils/todo-due.ts";
import { resolveAssignee } from "@/utils/todo-assignee.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await TodoRepo.getAll(householdId));
  },

  async POST(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await ctx.req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return badRequest("title required");
    const rawNotes = String(body.notes ?? "").trim();

    let dueAt: string | null = null;
    if (body.dueAt !== undefined) {
      const parsed = parseDueAt(body.dueAt);
      if (parsed === undefined) {
        return badRequest("dueAt must be null or a valid date string");
      }
      dueAt = parsed;
    }

    const assignedTo = await resolveAssignee(householdId, body.assignedTo);
    if (assignedTo === undefined) {
      return badRequest(
        "assignedTo must be null or a member of the household",
      );
    }

    const todo = await TodoRepo.create({
      householdId,
      title,
      notes: rawNotes || undefined,
      createdBy: actingMember.id,
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueAt,
      assignedTo,
      completedBy: null,
    });
    return json(todo, 201);
  },
});
