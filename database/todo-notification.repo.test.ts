import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name: "claim — the first call wins and the second loses",
  sanitizeResources: false,
  async fn() {
    const fp = "due@2026-08-06T07:00:00.000Z";
    assertEquals(
      await TodoNotificationRepo.claim("hh-c", "todo-1", fp, { sent: true }),
      true,
    );
    assertEquals(
      await TodoNotificationRepo.claim("hh-c", "todo-1", fp, { sent: true }),
      false,
    );
  },
});

Deno.test({
  name: "claim — a different fire-point on the same to-do is claimable",
  sanitizeResources: false,
  async fn() {
    const todo = "todo-2";
    await TodoNotificationRepo.claim(
      "hh-fp",
      todo,
      "due@2026-08-06T07:00:00.000Z",
      { sent: true },
    );
    assertEquals(
      await TodoNotificationRepo.claim(
        "hh-fp",
        todo,
        "due@2026-08-20T07:00:00.000Z",
        { sent: true },
      ),
      true,
    );
  },
});

Deno.test({
  name: "claim — households are isolated",
  sanitizeResources: false,
  async fn() {
    const fp = "due@2026-08-06T07:00:00.000Z";
    await TodoNotificationRepo.claim("hh-x", "todo-3", fp, { sent: true });
    assertEquals(
      await TodoNotificationRepo.claim("hh-y", "todo-3", fp, { sent: true }),
      true,
    );
  },
});

Deno.test({
  name: "claim — records whether it was sent or suppressed",
  sanitizeResources: false,
  async fn() {
    const kv = await (await import("@/database/db.ts")).getKv();
    const fp = "due@2026-07-01T07:00:00.000Z";
    await TodoNotificationRepo.claim("hh-sup", "todo-4", fp, { sent: false });

    const stored = await kv.get<{ sent: boolean; claimedAt: string }>([
      "todo_notifications",
      "hh-sup",
      "todo-4",
      fp,
    ]);
    assertEquals(stored.value?.sent, false);
    assertEquals(typeof stored.value?.claimedAt, "string");
  },
});

Deno.test({
  name: "deleteForTodo — removes every marker for that to-do and no others",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-cascade";
    await TodoNotificationRepo.claim(
      hh,
      "todo-a",
      "due@2026-08-06T07:00:00.000Z",
      { sent: true },
    );
    await TodoNotificationRepo.claim(
      hh,
      "todo-a",
      "due@2026-08-20T07:00:00.000Z",
      { sent: true },
    );
    await TodoNotificationRepo.claim(
      hh,
      "todo-b",
      "due@2026-08-06T07:00:00.000Z",
      { sent: true },
    );

    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-a"), 2);
    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-a"), 0);
    assertEquals(await TodoNotificationRepo.deleteForTodo(hh, "todo-b"), 1);
  },
});
