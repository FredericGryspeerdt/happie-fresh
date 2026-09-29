import { badRequest, define, json } from "@/utils/index.ts";
import { TodoRepo } from "@/database/todo.repo.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    // The device supplies its next local midnight as an instant (ADR 0004).
    // Counting on the server keeps window and service-worker badge rules equal.
    const before = new URL(ctx.req.url).searchParams.get("before") ?? "";
    const boundary = Date.parse(before);
    if (
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(before) || !Number.isFinite(boundary)
    ) {
      return badRequest("before must be a valid instant with a timezone");
    }
    const todos = await TodoRepo.getAll(householdId);
    const count = todos.filter((todo) =>
      todo.completedAt === null && todo.dueAt !== null &&
      Date.parse(todo.dueAt) < boundary
    ).length;
    const response = json({ count });
    response.headers.set("Cache-Control", "no-store");
    return response;
  },
});
