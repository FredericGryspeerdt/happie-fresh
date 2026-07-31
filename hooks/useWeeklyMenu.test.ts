import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import type {
  MenuEntryInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";

const menu = (entries: MenuEntryInterface[] = []): WeeklyMenuInterface => ({
  householdId: "h1",
  entries,
});

Deno.test("addDish — optimistic add, reconciles with the server menu", async () => {
  const server = menu([{ id: "e1", dishId: "d1", day: null }]);
  const add = stub(api.weeklyMenu, "addDish", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu());
  try {
    await hook.addDish("d1");
    assertEquals(hook.menu.value.entries.map((e) => e.id), ["e1"]);
    assertEquals(add.calls.length, 1);
    assertEquals([...hook.plannedDishIds.value], ["d1"]);
  } finally {
    add.restore();
  }
});

Deno.test("addDish — dedups a dish already in the plan (no API call)", async () => {
  const add = stub(api.weeklyMenu, "addDish", () => Promise.resolve(menu()));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.addDish("d1");
    assertEquals(add.calls.length, 0);
    assertEquals(hook.menu.value.entries.length, 1);
  } finally {
    add.restore();
  }
});

Deno.test("removeDishFromPlan — removes the entry matching the dish", async () => {
  const server = menu([{ id: "e2", dishId: "d2", day: null }]);
  const rm = stub(api.weeklyMenu, "removeEntry", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu([
    { id: "e1", dishId: "d1", day: null },
    { id: "e2", dishId: "d2", day: null },
  ]));
  try {
    await hook.removeDishFromPlan("d1");
    assertEquals(rm.calls[0].args, ["e1"]);
    assertEquals(hook.menu.value.entries.map((e) => e.dishId), ["d2"]);
  } finally {
    rm.restore();
  }
});

Deno.test("setDay — pins a weekday", async () => {
  const server = menu([{ id: "e1", dishId: "d1", day: "Wed" }]);
  const sd = stub(api.weeklyMenu, "setDay", () => Promise.resolve(server));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.setDay("e1", "Wed");
    assertEquals(hook.menu.value.entries[0].day, "Wed");
  } finally {
    sd.restore();
  }
});

Deno.test("sortedEntries — pinned Mon→Sun first, then Any-day in insertion order", () => {
  const hook = useWeeklyMenu(menu([
    { id: "e1", dishId: "d1", day: null },
    { id: "e2", dishId: "d2", day: "Fri" },
    { id: "e3", dishId: "d3", day: "Mon" },
    { id: "e4", dishId: "d4", day: null },
  ]));
  assertEquals(hook.sortedEntries.value.map((e) => e.id), [
    "e3",
    "e2",
    "e1",
    "e4",
  ]);
});

Deno.test("clear — rolls back when the API returns null", async () => {
  const cl = stub(api.weeklyMenu, "clear", () => Promise.resolve(null));
  const hook = useWeeklyMenu(menu([{ id: "e1", dishId: "d1", day: null }]));
  try {
    await hook.clear();
    assertEquals(hook.menu.value.entries.map((e) => e.id), ["e1"]); // restored
  } finally {
    cl.restore();
  }
});
