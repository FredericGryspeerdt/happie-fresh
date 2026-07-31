import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { WeeklyMenuRepo } from "@/database/weekly-menu.repo.ts";
import { getKv } from "@/database/db.ts";
import type { MenuEntryInterface } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see dish.repo.test.ts).
Deno.env.set("KV_PATH", ":memory:");

async function clearMenus() {
  const kv = await getKv();
  for await (const e of kv.list({ prefix: ["weekly_menu"] })) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "get — returns an empty menu for a household with no data",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    assertEquals(await WeeklyMenuRepo.get("h1"), {
      householdId: "h1",
      entries: [],
    });
  },
});

Deno.test({
  name: "addDish — appends an entry (id + day:null) and dedups by dishId",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const a = await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals(a.entries.length, 1);
    assertEquals(a.entries[0].dishId, "d1");
    assertEquals(a.entries[0].day, null);
    assertEquals(typeof a.entries[0].id, "string");
    const b = await WeeklyMenuRepo.addDish("h1", "d1"); // dedup
    assertEquals(b.entries.length, 1);
    const c = await WeeklyMenuRepo.addDish("h1", "d2");
    assertEquals(c.entries.map((e: MenuEntryInterface) => e.dishId), ["d1", "d2"]);
  },
});

Deno.test({
  name: "setDay — pins and clears a weekday on an entry",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const m = await WeeklyMenuRepo.addDish("h1", "d1");
    const id = m.entries[0].id;
    assertEquals((await WeeklyMenuRepo.setDay("h1", id, "Wed")).entries[0].day, "Wed");
    assertEquals((await WeeklyMenuRepo.setDay("h1", id, null)).entries[0].day, null);
  },
});

Deno.test({
  name: "removeEntry — drops the matching entry",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    const m = await WeeklyMenuRepo.addDish("h1", "d2");
    const id = m.entries[0].id;
    const after = await WeeklyMenuRepo.removeEntry("h1", id);
    assertEquals(after.entries.map((e: MenuEntryInterface) => e.dishId), ["d2"]);
  },
});

Deno.test({
  name: "clear — empties the menu",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals((await WeeklyMenuRepo.clear("h1")).entries, []);
  },
});

Deno.test({
  name: "scoping — a mutation on one household does not affect another",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("h1", "d1");
    assertEquals((await WeeklyMenuRepo.get("h2")).entries, []);
  },
});
