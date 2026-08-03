import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { DishTagGroupRepo } from "@/database/dish-tag-group.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

async function clearGroups() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["dish_tag_groups"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "ensureDefaults — seeds the three default groups with values",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const groups = await DishTagGroupRepo.getAll("hh-a");
    assertEquals(groups.map((g) => g.label), ["Type", "Meal", "Side type"]);
    assertEquals(groups[0].values.map((v) => v.label), [
      "Vegetarian",
      "Fish",
      "Meat",
    ]);
    // every value has a non-empty id
    for (const g of groups) {
      for (const v of g.values) assertEquals(typeof v.id, "string");
    }
  },
});

Deno.test({
  name: "ensureDefaults — is idempotent (second call adds nothing)",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const groups = await DishTagGroupRepo.getAll("hh-a");
    assertEquals(groups.length, 3);
  },
});

Deno.test({
  name: "ensureDefaults — seeds each household independently",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    // hh-b has not been seeded yet.
    assertEquals(await DishTagGroupRepo.getAll("hh-b"), []);
    await DishTagGroupRepo.ensureDefaults("hh-b");
    assertEquals((await DishTagGroupRepo.getAll("hh-b")).length, 3);
    // Adding a value to hh-a must not appear in hh-b.
    const [typeA] = await DishTagGroupRepo.getAll("hh-a");
    await DishTagGroupRepo.addValue("hh-a", typeA.id, "Vegan");
    const [typeB] = await DishTagGroupRepo.getAll("hh-b");
    assertEquals(typeB.values.some((v) => v.label === "Vegan"), false);
  },
});

Deno.test({
  name: "addValue — appends a value to a group and returns it",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    await DishTagGroupRepo.ensureDefaults("hh-a");
    const [type] = await DishTagGroupRepo.getAll("hh-a");
    const created = await DishTagGroupRepo.addValue("hh-a", type.id, "Vegan");
    assertEquals(created?.label, "Vegan");
    const reloaded = await DishTagGroupRepo.getById("hh-a", type.id);
    assertEquals(reloaded?.values.at(-1)?.label, "Vegan");
  },
});

Deno.test({
  name: "addValue — returns null for a missing group",
  sanitizeResources: false,
  async fn() {
    await clearGroups();
    assertEquals(await DishTagGroupRepo.addValue("hh-a", "nope", "x"), null);
  },
});
