import { assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import { scopeGlobalCatalogue } from "./migrate.ts";

async function clearCatalogue() {
  const kv = await getKv();
  for (const c of ["items", "categories", "dishes", "dish_tag_groups"]) {
    for await (const e of kv.list({ prefix: [c] })) await kv.delete(e.key);
  }
}

Deno.test({
  name:
    "scopeGlobalCatalogue — moves globals under the household, deletes globals",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await kv.set(["categories", "c1"], { id: "c1", label: "Dairy" });
    await kv.set(["dishes", "d1"], { id: "d1", name: "Curry" });
    await kv.set(["dish_tag_groups", "g1"], {
      id: "g1",
      label: "Type",
      values: [],
    });

    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts, {
      items: 1,
      categories: 1,
      dishes: 1,
      dish_tag_groups: 1,
    });

    // Global keys removed; scoped keys present.
    assertEquals((await kv.get(["items", "i1"])).value, null);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    assertEquals((await kv.get(["dishes", "hh-1", "d1"])).value, {
      id: "d1",
      name: "Curry",
    });
  },
});

Deno.test({
  name: "scopeGlobalCatalogue — idempotent; leaves already-scoped entries",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await scopeGlobalCatalogue(kv, "hh-1");

    // Second run: nothing global left to move.
    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts.items, 0);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    // No stray global (length-2) key reappeared.
    let globals = 0;
    for await (const e of kv.list({ prefix: ["items"] })) {
      if (e.key.length === 2) globals++;
    }
    assertEquals(globals, 0);
  },
});
