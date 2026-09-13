import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import type { Context } from "fresh";
import { handler } from "./move-items.ts";
import type { StateInterface } from "@/utils/define.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
Deno.env.set("KV_PATH", ":memory:");
function ctx(
  id: string,
  body: unknown,
  householdId?: string,
): Context<StateInterface> {
  return {
    params: { id },
    state: {
      householdId,
      actingMember: householdId ? { id: "member" } : undefined,
    },
    req: new Request("http://x", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as unknown as Context<StateInterface>;
}
Deno.test({
  name:
    "move endpoint rejects absent authentication, malformed input and foreign lists",
  sanitizeResources: false,
  async fn() {
    const source = await ShoppingListRepo.create({
      householdId: "http-house",
      name: "Weekly",
      createdAt: "2026-09-12",
      createdBy: "member",
    });
    const item = await ShoppingListItemRepo.add(source.id, "milk");
    assertEquals(
      (await handler.POST(ctx(source.id, {}, undefined))).status,
      401,
    );
    for (
      const body of [null, [], {}, {
        requestId: "req",
        itemIds: [item.id],
        newListName: 2,
      }, { requestId: "req", itemIds: [item.id], newListName: {} }]
    ) {
      assertEquals(
        (await handler.POST(ctx(source.id, body, "http-house"))).status,
        400,
      );
    }
    const input = {
      requestId: crypto.randomUUID(),
      itemIds: [item.id],
      newListName: "Quick trip",
    };
    assertEquals(
      (await handler.POST(ctx(source.id, input, "foreign"))).status,
      403,
    );
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 1);
    const response = await handler.POST(ctx(source.id, input, "http-house"));
    assertEquals(response.status, 200);
    const moved = await response.json();
    assert(moved.ok);
    assertEquals(moved.destination.createdBy, "member");
    assertEquals(
      (await handler.POST(
        ctx(source.id, { undoRequestId: input.requestId }, "foreign"),
      )).status,
      403,
    );
    const undone = await handler.POST(
      ctx(source.id, { undoRequestId: input.requestId }, "http-house"),
    );
    assertEquals(undone.status, 200);
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 1);
  },
});
