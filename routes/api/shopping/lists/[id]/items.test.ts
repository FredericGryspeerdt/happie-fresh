import { assertEquals } from "jsr:@std/assert@^1.0.19";
import type { Context } from "fresh";
import { handler } from "./items.ts";
import { ShoppingListItemRepo, ShoppingListRepo } from "@/database/index.ts";
import type { StateInterface } from "@/utils/index.ts";
Deno.env.set("KV_PATH", ":memory:");
Deno.test({
  name:
    "PATCH — validates and stores fractional amounts without losing other fields",
  sanitizeResources: false,
  async fn() {
    const list = await ShoppingListRepo.create({
      householdId: "patch-house",
      name: "Weekly shop",
      createdBy: "m",
      createdAt: new Date().toISOString(),
    });
    const entry = await ShoppingListItemRepo.add(list.id, "meat");
    const patch = (body: unknown) =>
      handler.PATCH({
        req: new Request("http://x/items", {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
        params: { id: list.id },
        state: { householdId: "patch-house" },
      } as unknown as Context<StateInterface>);
    for (
      const body of [
        { quantity: 0 },
        { quantity: -2 },
        { quantity: 100000 },
        { quantity: 0.1234 },
        { quantity: "2" },
        { unit: "oz" },
      ]
    ) {
      assertEquals((await patch({ id: entry.id, ...body })).status, 400);
    }
    const res = await patch({
      id: entry.id,
      quantity: 0.5,
      unit: "kg",
      note: "Lean",
    });
    assertEquals(res.status, 200);
    assertEquals((await res.json()).unit, "kg");
    await patch({ id: entry.id, checked: true });
    const saved = (await ShoppingListItemRepo.getAll(list.id))[0];
    assertEquals(saved.quantity, 0.5);
    assertEquals(saved.unit, "kg");
    assertEquals(saved.note, "Lean");
    assertEquals(saved.checked, true);
  },
});
