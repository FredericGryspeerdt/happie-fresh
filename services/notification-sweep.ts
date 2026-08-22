import { getKv } from "@/database/db.ts";
import type { TodoInterface } from "@/models/index.ts";
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";
import { isPushConfigured, sendToHousehold } from "./push-send.ts";
import { selectDueFirePoints } from "@/utils/todo-fire-points.ts";

/**
 * One pass of the due-notification sweep.
 *
 * Deliberately separate from the `Deno.cron` registration in main.ts so it can be
 * called directly. Delivery is a sweep rather than a scheduled job because KV
 * queues are unsupported on the new Deno Deploy — and because nothing needs
 * cancelling when a to-do is edited, ticked off or deleted (docs/adr/0005).
 *
 * Claim always precedes send: cron retries a failed handler, so a claim-after-send
 * could double-notify and a send-without-claim could lose one.
 */
export async function sweepDueNotifications(): Promise<
  { claimed: number; sent: number; suppressed: number }
> {
  if (!isPushConfigured()) {
    console.warn("[sweep] VAPID env not set — skipping");
    return { claimed: 0, sent: 0, suppressed: 0 };
  }

  const kv = await getKv();
  const todos: TodoInterface[] = [];
  for await (const { value } of kv.list<TodoInterface>({ prefix: ["todos"] })) {
    todos.push(value);
  }

  const due = selectDueFirePoints(todos, new Date());
  let claimed = 0;
  let sent = 0;
  let suppressed = 0;

  // Read each household's devices once per run: several to-dos sharing the 09:00
  // default is the common case, so re-reading per to-do is pure waste.
  const subsByHousehold = new Map<
    string,
    Awaited<ReturnType<typeof PushSubscriptionRepo.getAll>>
  >();

  for (const { todo, firePointId, withinWindow } of due) {
    const won = await TodoNotificationRepo.claim(
      todo.householdId,
      todo.id,
      firePointId,
      { sent: withinWindow },
    );
    if (!won) continue;
    claimed++;

    if (!withinWindow) {
      suppressed++;
      continue;
    }

    if (!subsByHousehold.has(todo.householdId)) {
      subsByHousehold.set(
        todo.householdId,
        await PushSubscriptionRepo.getAll(todo.householdId),
      );
    }

    const result = await sendToHousehold(
      todo.householdId,
      {
        title: todo.title,
        body: "Due now",
        tag: `todo-${todo.id}`,
        url: "/todos",
      },
      subsByHousehold.get(todo.householdId),
    );
    sent += result.sent;
  }

  // Logged on every run, including empty ones. A sweep that only spoke up when
  // it claimed something made "cron never fired here" and "cron fired and
  // selected nothing" indistinguishable in the deployment logs — which are the
  // only view into this, since nothing about a missed notification is visible
  // in the app. One line per five minutes is worth that.
  console.info(
    `[sweep] scanned=${todos.length} due=${due.length} claimed=${claimed} ` +
      `sent=${sent} suppressed=${suppressed}`,
  );
  return { claimed, sent, suppressed };
}
