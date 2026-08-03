import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { ItemRepo } from "@/database/item.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process (see shopping-list-item.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearItems() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["items"] })) await kv.delete(e.key);
}

Deno.test({
  name: "create + readAll + getById — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const created = await ItemRepo.create("hh-a", { name: "Milk" });
    assertEquals(typeof created.id, "string");
    const fetched = await ItemRepo.getById("hh-a", created.id);
    assertEquals(fetched?.name, "Milk");
    const all = await ItemRepo.readAll("hh-a");
    assertEquals(all.map((i) => i.name), ["Milk"]);
  },
});

Deno.test({
  name: "readAll/getById — household A cannot see household B's items",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const a = await ItemRepo.create("hh-a", { name: "Apples" });
    await ItemRepo.create("hh-b", { name: "Bananas" });
    assertEquals((await ItemRepo.readAll("hh-a")).map((i) => i.name), [
      "Apples",
    ]);
    assertEquals((await ItemRepo.readAll("hh-b")).map((i) => i.name), [
      "Bananas",
    ]);
    // B cannot fetch A's item by id.
    assertEquals(await ItemRepo.getById("hh-b", a.id), null);
  },
});

Deno.test({
  name: "update + delete — scoped to the household",
  sanitizeResources: false,
  async fn() {
    await clearItems();
    const item = await ItemRepo.create("hh-a", { name: "Bread" });
    await ItemRepo.update("hh-a", item.id, { id: item.id, name: "Sourdough" });
    assertEquals((await ItemRepo.getById("hh-a", item.id))?.name, "Sourdough");
    await ItemRepo.delete("hh-a", item.id);
    assertEquals(await ItemRepo.getById("hh-a", item.id), null);
    assert((await ItemRepo.readAll("hh-a")).length === 0);
  },
});
