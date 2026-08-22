import { DishRepo, WeeklyMenuRepo } from "@/database/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import type { Weekday } from "@/models/index.ts";
import { define } from "@/utils/index.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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
    if (!parsed.ok) return new Response("invalid JSON", { status: 400 });
    const { dishId } = parsed.body as { dishId?: string };
    if (!dishId) return new Response("dishId required", { status: 400 });
    const dish = await DishRepo.getById(householdId, dishId);
    if (!dish) return new Response("unknown dish", { status: 400 });
    return json(await WeeklyMenuRepo.addDish(householdId, dishId));
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return new Response("invalid JSON", { status: 400 });
    const { entryId, day } = parsed.body as {
      entryId?: string;
      day?: Weekday | null;
    };
    if (!entryId) return new Response("entryId required", { status: 400 });
    if (day !== null && !WEEKDAY_ORDER.includes(day as Weekday)) {
      return new Response("invalid day", { status: 400 });
    }
    return json(await WeeklyMenuRepo.setDay(householdId, entryId, day ?? null));
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const parsed = await readJsonBody(ctx.req);
    if (!parsed.ok) return new Response("invalid JSON", { status: 400 });
    const { entryId, clear } = parsed.body as {
      entryId?: string;
      clear?: boolean;
    };
    if (clear === true) return json(await WeeklyMenuRepo.clear(householdId));
    if (!entryId) {
      return new Response("entryId or clear required", { status: 400 });
    }
    return json(await WeeklyMenuRepo.removeEntry(householdId, entryId));
  },
});
