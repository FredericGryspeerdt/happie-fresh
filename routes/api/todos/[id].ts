import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
} from "@/utils/index.ts";
import { TodoRepo } from "@/database/index.ts";
import type { UpdateTodoDto } from "@/models/index.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    const body = await ctx.req.json();
    const patch: UpdateTodoDto = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return badRequest("title required");
      patch.title = title;
    }
    if (body.notes !== undefined) {
      // Empty string, not undefined: mergeDefinedPatch skips undefined, so
      // `undefined` here would silently leave an existing note in place and
      // clearing notes in the UI would appear to fail.
      patch.notes = String(body.notes).trim();
    }
    if (body.completedAt !== undefined) {
      patch.completedAt = body.completedAt === null
        ? null
        : String(body.completedAt);
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
