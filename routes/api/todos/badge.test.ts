import { assertEquals } from "jsr:@std/assert@^1.0.19";
import type { Context } from "fresh";
import type { StateInterface } from "@/utils/define.ts";
import { handler } from "./badge.ts";
import { TodoRepo } from "@/database/todo.repo.ts";

Deno.env.set("KV_PATH", ":memory:");
function ctx(before: string, householdId?: string) {
  return {
    req: new Request(
      `https://happie.test/api/todos/badge?before=${
        encodeURIComponent(before)
      }`,
    ),
    state: { householdId },
  } as Context<StateInterface>;
}

Deno.test({
  name:
    "badge counts open household to-dos before the device's next midnight, including overdue",
  sanitizeResources: false,
  async fn() {
    const householdId = crypto.randomUUID();
    for (
      const [dueAt, completedAt, hh] of [
        ["2026-01-01T00:00:00Z", null, householdId],
        ["2026-09-29T21:59:59.999Z", null, householdId],
        ["2026-09-29T22:00:00Z", null, householdId],
        ["2026-09-28T12:00:00Z", "2026-09-29T08:00:00Z", householdId],
        [null, null, householdId],
        ["2026-09-29T10:00:00Z", null, "other"],
      ]
    ) {
      await TodoRepo.create({
        householdId: hh!,
        title: "Test",
        createdBy: "m",
        createdAt: "2026-01-01T00:00:00Z",
        dueAt,
        completedAt,
        assignedTo: null,
        completedBy: null,
      });
    }
    const res = await handler.GET(
      ctx("2026-09-30T00:00:00+02:00", householdId),
    );
    assertEquals(await res.json(), { count: 2 });
    assertEquals(res.headers.get("Cache-Control"), "no-store");
    assertEquals(
      await (await handler.GET(ctx("2026-09-30T00:00:00+02:00", "empty")))
        .json(),
      { count: 0 },
    );
  },
});

Deno.test("badge rejects unauthenticated requests and invalid day boundaries", async () => {
  assertEquals((await handler.GET(ctx("2026-09-30T00:00:00Z"))).status, 401);
  for (const before of ["", "garbage", "2026-09-30", "2026-09-30T00:00:00"]) {
    assertEquals((await handler.GET(ctx(before, "h"))).status, 400);
  }
});
