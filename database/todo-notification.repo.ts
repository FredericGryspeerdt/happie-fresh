import { getKv } from "./db.ts";

export interface TodoNotificationMarker {
  claimedAt: string;
  /** false = deliberately suppressed (past the staleness cutoff), not delivered. */
  sent: boolean;
}

/**
 * Delivery bookkeeping for to-do notifications — deliberately NOT a field on the
 * to-do. `Deno.cron` retries a failed handler, so "have I already sent this?"
 * must be an atomic **claim** rather than read-then-write; a flag on the to-do
 * would need compare-and-swap on the whole record and would race member edits
 * through an already non-atomic `TodoRepo.update`. See docs/adr/0005.
 *
 * Keys are `["todo_notifications", householdId, todoId, firePointId]`, where
 * firePointId is `due@<ISO instant>`. The instant is part of the id so that
 * rescheduling a to-do mints a new fire-point and notifies again, while a repeat
 * run against the same instant still sends once.
 */
export class TodoNotificationRepo {
  /** Returns true only if this call won the claim. */
  static async claim(
    householdId: string,
    todoId: string,
    firePointId: string,
    opts: { sent: boolean },
  ): Promise<boolean> {
    const kv = await getKv();
    const key = ["todo_notifications", householdId, todoId, firePointId];
    const marker: TodoNotificationMarker = {
      claimedAt: new Date().toISOString(),
      sent: opts.sent,
    };
    // check({ versionstamp: null }) commits only if the key does not exist, so a
    // concurrent run or a cron retry loses and skips.
    const res = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, marker)
      .commit();
    return res.ok;
  }

  /** Cascade for TodoRepo.delete — markers must not outlive their to-do. */
  static async deleteForTodo(
    householdId: string,
    todoId: string,
  ): Promise<number> {
    const kv = await getKv();
    const iter = kv.list({
      prefix: ["todo_notifications", householdId, todoId],
    });
    const keys: Deno.KvKey[] = [];
    for await (const { key } of iter) keys.push(key);
    if (keys.length === 0) return 0;

    let atomic = kv.atomic();
    for (const key of keys) atomic = atomic.delete(key);
    const res = await atomic.commit();
    if (!res.ok) throw new Error("Failed to delete notification markers.");
    return keys.length;
  }
}
