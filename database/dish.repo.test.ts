import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { DishRepo } from "@/database/dish.repo.ts";
import { getKv } from "@/database/db.ts";
import type { CreateDishDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearDishes() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dishes"] })) await kv.delete(e.key);
}

Deno.test({
  name: "create + getById — round-trips fields and assigns id + createdAt",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await DishRepo.create({
      name: "Pasta Bolognese",
      ingredientIds: ["i1", "i2"],
      tagValueIds: ["meat", "main"],
    });
    assertEquals(typeof created.id, "string");
    assertEquals(typeof created.createdAt, "string");
    const fetched = await DishRepo.getById(created.id);
    assertEquals(fetched?.name, "Pasta Bolognese");
    assertEquals(fetched?.ingredientIds, ["i1", "i2"]);
    assertEquals(fetched?.tagValueIds, ["meat", "main"]);
  },
});

Deno.test({
  name: "create — defaults ingredientIds/tagValueIds to [] when omitted",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const created = await DishRepo.create(
      { name: "Bare" } as CreateDishDto,
    );
    const fetched = await DishRepo.getById(created.id);
    assertEquals(fetched?.ingredientIds, []);
    assertEquals(fetched?.tagValueIds, []);
  },
});

Deno.test({
  name: "update — partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create({
      name: "Curry",
      ingredientIds: ["i1"],
      tagValueIds: ["veg"],
    });
    const updated = await DishRepo.update(d.id, { name: "Veggie Curry" });
    assertEquals(updated?.name, "Veggie Curry");
    assertEquals(updated?.ingredientIds, ["i1"]); // untouched
    assertEquals(updated?.tagValueIds, ["veg"]); // untouched
  },
});

Deno.test({
  name: "update — returns null for a missing dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    assertEquals(await DishRepo.update("nope", { name: "x" }), null);
  },
});

Deno.test({
  name: "delete — removes the dish",
  sanitizeResources: false,
  async fn() {
    await clearDishes();
    const d = await DishRepo.create({
      name: "Toast",
      ingredientIds: [],
      tagValueIds: [],
    });
    await DishRepo.delete(d.id);
    assertEquals(await DishRepo.getById(d.id), null);
    assertEquals(await DishRepo.readAll(), []);
  },
});
