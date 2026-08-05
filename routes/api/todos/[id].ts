import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
} from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";
import type { UpdateTodoDto } from "@/models/index.ts";
import { parseDueAt } from "@/utils/todo-due.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const body = await ctx.req.json();
    const patch: UpdateTodoDto = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        return badRequest("title must be a string");
      }
      const title = body.title.trim();
      if (!title) return badRequest("title required");
      patch.title = title;
    }
    if (body.notes !== undefined) {
      if (typeof body.notes !== "string") {
        return badRequest("notes must be a string");
      }
      // Empty string, not undefined: mergeDefinedPatch skips undefined, so
      // `undefined` here would silently leave an existing note in place and
      // clearing notes in the UI would appear to fail.
      patch.notes = body.notes.trim();
    }
    if (body.completedAt !== undefined) {
      if (body.completedAt === null) {
        patch.completedAt = null;
      } else {
        if (
          typeof body.completedAt !== "string" ||
          Number.isNaN(Date.parse(body.completedAt))
        ) {
          return badRequest("completedAt must be null or a valid date string");
        }
        patch.completedAt = body.completedAt;
      }
    }
    if (body.dueAt !== undefined) {
      const parsed = parseDueAt(body.dueAt);
      if (parsed === undefined) {
        return badRequest("dueAt must be null or a valid date string");
      }
      patch.dueAt = parsed;
    }

    const updated = await TodoRepo.update(householdId, ctx.params.id, patch);
    if (!updated) return notFound("no such to-do");
    return json(updated);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const existing = await TodoRepo.getById(householdId, ctx.params.id);
    if (!existing) return notFound("no such to-do");

    await TodoRepo.delete(householdId, existing.id);
    return noContent();
  },
});
