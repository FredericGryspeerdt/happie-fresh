import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { loadHome } from "./home.ts";
import {
  DishRepo,
  ShoppingListItemRepo,
  ShoppingListRepo,
  TodoRepo,
  WeeklyMenuRepo,
} from "@/database/index.ts";
Deno.env.set("KV_PATH", ":memory:");
Deno.test({
  name:
    "Start loader isolates household data and preserves unchecked entries and legacy hidden lists",
  sanitizeResources: false,
  async fn() {
    const h = crypto.randomUUID(), other = crypto.randomUUID();
    const local = await ShoppingListRepo.create({
      householdId: h,
      name: "Weekly",
      createdBy: "m",
      createdAt: "2026-09-30",
    });
    const foreign = await ShoppingListRepo.create({
      householdId: other,
      name: "Private",
      createdBy: "m",
      createdAt: "2026-09-30",
      showOnHome: true,
    });
    await ShoppingListItemRepo.add(local.id, "milk");
    await ShoppingListItemRepo.add(foreign.id, "private-item");
    for (const householdId of [h, other]) {
      await TodoRepo.create({
        householdId,
        title: householdId,
        createdBy: "m",
        createdAt: "2026-09-30",
        dueAt: null,
        completedAt: null,
        assignedTo: null,
        completedBy: null,
      });
    }
    const dish = await DishRepo.create(h, {
      name: "Lasagne",
      ingredientIds: [],
      tagValueIds: [],
    });
    await WeeklyMenuRepo.addDish(h, dish.id);
    const data = await loadHome(h);
    assertEquals(data.lists.map((l) => l.id), [local.id]);
    assertEquals(data.lists[0].entries.map((e) => e.itemId), ["milk"]);
    assertEquals(data.lists[0].showOnHome === true, false);
    assertEquals(data.todos.map((t) => t.householdId), [h]);
    assertEquals(data.menu.entries.map((e) => e.dishId), [dish.id]);
  },
});
