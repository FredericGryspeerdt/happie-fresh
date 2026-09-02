import { DishRepo, WeeklyMenuRepo } from "@/database/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import type { Weekday } from "@/models/index.ts";
import { badRequest, json } from "@/utils/index.ts";
import { define } from "@/utils/index.ts";

async function readJsonBody(
  req: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false };
  }
}

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    return json(await WeeklyMenuRepo.get(householdId));
  },

  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return badRequest("invalid JSON");
    const { dishId } = parsed.body as { dishId?: string };
    if (!dishId) return badRequest("dishId required");
    const dish = await DishRepo.getById(householdId, dishId);
    if (!dish) return badRequest("unknown dish");
    return json(await WeeklyMenuRepo.addDish(householdId, dishId));
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return badRequest("invalid JSON");
    const { entryId, day } = parsed.body as {
      entryId?: string;
      day?: Weekday | null;
    };
    if (!entryId) return badRequest("entryId required");
    if (day !== null && !WEEKDAY_ORDER.includes(day as Weekday)) {
      return badRequest("invalid day");
    }
    return json(await WeeklyMenuRepo.setDay(householdId, entryId, day ?? null));
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return badRequest("invalid JSON");
    const { entryId, clear } = parsed.body as {
      entryId?: string;
      clear?: boolean;
    };
    if (clear === true) return json(await WeeklyMenuRepo.clear(householdId));
    if (!entryId) return badRequest("entryId or clear required");
    return json(await WeeklyMenuRepo.removeEntry(householdId, entryId));
  },
});
