import { define, json } from "@/utils/index.ts";
import { sweepDueNotifications } from "@/services/notification-sweep.ts";

/**
 * Runs one delivery sweep on demand — the same function `Deno.cron` calls.
 *
 * Exists because a missing scheduled notification has two very different causes
 * that otherwise look identical: cron not running on this timeline at all (Deno
 * Deploy schedules cron per timeline), or cron running fine while the selection
 * rules skip the to-do. Hitting this endpoint separates them in one request —
 * counts come back, so `claimed=0` points at selection and a working send points
 * at scheduling.
 *
 * Safe to call repeatedly: the sweep claims each fire-point atomically before
 * sending, so a manual run cannot double-notify or race the cron one. It is the
 * claim, not the caller, that makes delivery exactly-once.
 */
export const handler = define.handlers({
  async POST(ctx) {
    // Household-scoped like every other route here. The sweep itself is
    // global — it has to be, since cron has no session — so this authorises the
    // *trigger*, not the scope of what it processes.
    if (!ctx.state.householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    return json(await sweepDueNotifications());
  },
});
