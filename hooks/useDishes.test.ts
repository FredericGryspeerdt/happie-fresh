import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useDishes } from "@/hooks/useDishes.ts";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";

const dish = (
  id: string,
  name: string,
  tagValueIds: string[] = [],
): DishInterface => ({ id, name, ingredientIds: [], tagValueIds });

const group = (
  id: string,
  label: string,
  values: [string, string][],
  order = 0,
): DishTagGroupInterface => ({
  id,
  label,
  order,
  values: values.map(([vid, l]) => ({ id: vid, label: l })),
});

Deno.test("filtered — case-insensitive name query", () => {
  const hook = useDishes(
    [dish("1", "Pasta Bolognese"), dish("2", "Veggie Curry")],
    [],
  );
  hook.query.value = "curry";
  assertEquals(hook.filtered.value.map((d) => d.name), ["Veggie Curry"]);
});

Deno.test("filtered — OR within a group, AND across groups", () => {
  const groups = [
    group("type", "Type", [["veg", "Vegetarian"], ["fish", "Fish"], [
      "meat",
      "Meat",
    ]]),
    group("meal", "Meal", [["main", "Main dish"], ["side", "Side dish"]], 1),
  ];
  const hook = useDishes([
    dish("1", "Veg Main", ["veg", "main"]),
    dish("2", "Fish Main", ["fish", "main"]),
    dish("3", "Veg Side", ["veg", "side"]),
    dish("4", "Meat Main", ["meat", "main"]),
  ], groups);
  hook.toggleTagValue("veg"); // Type: veg
  hook.toggleTagValue("fish"); // Type: veg OR fish
  hook.toggleTagValue("main"); // Meal: main  → (veg|fish) AND main
  assertEquals(hook.filtered.value.map((d) => d.name), [
    "Fish Main",
    "Veg Main",
  ]);
});

Deno.test("clearFilters — removes all selected tag values", () => {
  const hook = useDishes([dish("1", "A", ["veg"])], []);
  hook.toggleTagValue("veg");
  hook.clearFilters();
  assertEquals(hook.selectedTagValueIds.value.size, 0);
});

Deno.test("removeDish — optimistically removes and calls the API", async () => {
  const del = stub(api.dishes, "delete", () => Promise.resolve());
  try {
    const hook = useDishes([dish("1", "A"), dish("2", "B")], []);
    await hook.removeDish("1");
    assertEquals(hook.dishes.value.map((d) => d.id), ["2"]);
    assertEquals(del.calls.length, 1);
  } finally {
    del.restore();
  }
});
