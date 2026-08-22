import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
} from "@/utils/index.ts";
import { MemberRepo, TodoRepo } from "@/database/index.ts";
import type { UpdateTodoDto } from "@/models/index.ts";
import { parseDueAt } from "@/utils/todo-due.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }

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
        patch.completedBy = null;
      } else {
        if (
          typeof body.completedAt !== "string" ||
          Number.isNaN(Date.parse(body.completedAt))
        ) {
          return badRequest("completedAt must be null or a valid date string");
        }
        patch.completedAt = body.completedAt;
        // Fact, stamped server-side: whoever is acting ticked it off. A
        // client-sent completedBy is deliberately ignored (docs/adr/0007).
        patch.completedBy = actingMember.id;
      }
    }
    if (body.dueAt !== undefined) {
      const parsed = parseDueAt(body.dueAt);
      if (parsed === undefined) {
        return badRequest("dueAt must be null or a valid date string");
      }
      patch.dueAt = parsed;
    }
    if (body.assignedTo !== undefined) {
      if (body.assignedTo === null) {
        patch.assignedTo = null;
      } else if (
        typeof body.assignedTo !== "string" ||
        !(await MemberRepo.getById(householdId, body.assignedTo))
      ) {
        return badRequest(
          "assignedTo must be null or a member of the household",
        );
      } else {
        patch.assignedTo = body.assignedTo;
      }
    }

    const updated = await TodoRepo.update(householdId, ctx.params.id, patch);
    if (!updated) return notFound("no such to-do");
    return json(updated);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // "Not needed" is a deletion (ADR 0002) and deletions are manager-only
    // (ADR 0006): a kid ticks things off; deciding "we dropped it" is a
    // manager call.
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;

    const existing = await TodoRepo.getById(householdId, ctx.params.id);
    if (!existing) return notFound("no such to-do");

    await TodoRepo.delete(householdId, existing.id);
    return noContent();
  },
});
