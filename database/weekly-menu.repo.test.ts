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

async function storedVersionstamp(householdId: string) {
  const kv = await getKv();
  const res = await kv.get<unknown>(["weekly_menu", householdId]);
  return res.versionstamp;
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
    assertEquals(c.entries.map((e: MenuEntryInterface) => e.dishId), [
      "d1",
      "d2",
    ]);
  },
});

Deno.test({
  name: "setDay — pins and clears a weekday on an entry",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    const m = await WeeklyMenuRepo.addDish("h1", "d1");
    const id = m.entries[0].id;
    assertEquals(
      (await WeeklyMenuRepo.setDay("h1", id, "Wed")).entries[0].day,
      "Wed",
    );
    assertEquals(
      (await WeeklyMenuRepo.setDay("h1", id, null)).entries[0].day,
      null,
    );
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
    assertEquals(after.entries.map((e: MenuEntryInterface) => e.dishId), [
      "d2",
    ]);
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
  name: "clear on an already-empty menu does not persist anything",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.clear("noop-h");
    assertEquals(await storedVersionstamp("noop-h"), null);
  },
});

Deno.test({
  name: "removeEntry with an unknown entryId leaves the menu untouched",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await WeeklyMenuRepo.addDish("noop-h", "d1");
    const stampBefore = await storedVersionstamp("noop-h");
    await WeeklyMenuRepo.removeEntry("noop-h", "missing");
    assertEquals(await storedVersionstamp("noop-h"), stampBefore);
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

Deno.test({
  name:
    "addDish — concurrent adds of different dishes both persist (atomic CAS)",
  sanitizeResources: false,
  async fn() {
    await clearMenus();
    await Promise.all([
      WeeklyMenuRepo.addDish("h1", "d1"),
      WeeklyMenuRepo.addDish("h1", "d2"),
    ]);
    const m = await WeeklyMenuRepo.get("h1");
    assertEquals(m.entries.length, 2);
    assertEquals(
      new Set(m.entries.map((e) => e.dishId)),
      new Set(["d1", "d2"]),
    );
  },
});
