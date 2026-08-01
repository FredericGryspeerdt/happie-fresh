import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { CategoryRepo } from "@/database/category.repo.ts";
import { getKv } from "@/database/db.ts";

Deno.env.set("KV_PATH", ":memory:");

async function clearCategories() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["categories"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "create — appends order per household and stores creator",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const first = await CategoryRepo.create("hh-a", "Produce", "u1");
    const second = await CategoryRepo.create("hh-a", "Dairy", "u1");
    assertEquals(first.order, 0);
    assertEquals(second.order, 1);
    assertEquals(first.createdBy, "u1");
  },
});

Deno.test({
  name: "getAll — isolated per household and ordered",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    await CategoryRepo.create("hh-a", "Produce", "u1");
    await CategoryRepo.create("hh-b", "Frozen", "u2");
    assertEquals((await CategoryRepo.getAll("hh-a")).map((c) => c.label), [
      "Produce",
    ]);
    assertEquals((await CategoryRepo.getAll("hh-b")).map((c) => c.label), [
      "Frozen",
    ]);
    // Each household's order restarts at 0.
    assertEquals((await CategoryRepo.getAll("hh-b"))[0].order, 0);
  },
});

Deno.test({
  name: "update/delete/reorder — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearCategories();
    const a = await CategoryRepo.create("hh-a", "Produce", "u1");
    const b = await CategoryRepo.create("hh-a", "Dairy", "u1");
    // update
    const updated = await CategoryRepo.update("hh-a", a.id, { label: "Fruit" });
    assertEquals(updated?.label, "Fruit");
    // update on wrong household is a no-op miss
    assertEquals(await CategoryRepo.update("hh-b", a.id, { label: "X" }), null);
    // reorder
    await CategoryRepo.reorder("hh-a", [
      { id: a.id, order: 1 },
      { id: b.id, order: 0 },
    ]);
    assertEquals((await CategoryRepo.getAll("hh-a")).map((c) => c.id), [
      b.id,
      a.id,
    ]);
    // delete
    await CategoryRepo.delete("hh-a", a.id);
    assertEquals(await CategoryRepo.getById("hh-a", a.id), null);
  },
});
