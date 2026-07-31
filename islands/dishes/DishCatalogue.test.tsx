import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DishCatalogue from "./DishCatalogue.tsx";

Deno.test("DishCatalogue — renders dishes, tag filter groups, and the add FAB", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [
      {
        id: "1",
        name: "Pasta Bolognese",
        ingredientIds: ["a", "b"],
        tagValueIds: ["meat"],
      },
      {
        id: "2",
        name: "Veggie Curry",
        ingredientIds: ["c"],
        tagValueIds: ["veg"],
      },
    ],
    initialTagGroups: [
      {
        id: "type",
        label: "Type",
        order: 0,
        values: [{ id: "veg", label: "Vegetarian" }, {
          id: "meat",
          label: "Meat",
        }],
      },
    ],
  }));
  assertStringIncludes(html, "Pasta Bolognese");
  assertStringIncludes(html, "Veggie Curry");
  assertStringIncludes(html, "Type"); // group label
  assertStringIncludes(html, "Vegetarian"); // value chip
  assertStringIncludes(html, "Add dish"); // FAB label
});

Deno.test("DishCatalogue — empty state prompts adding a dish", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [],
    initialTagGroups: [],
  }));
  assertStringIncludes(html, "No dishes yet");
});

Deno.test("DishCatalogue — shows Added for a dish already in the week", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [
      { id: "1", name: "Pasta Bolognese", ingredientIds: [], tagValueIds: [] },
      { id: "2", name: "Veggie Curry", ingredientIds: [], tagValueIds: [] },
    ],
    initialTagGroups: [],
    initialMenu: {
      householdId: "h1",
      entries: [{ id: "e1", dishId: "1", day: null }],
    },
  }));
  assertStringIncludes(html, "Added"); // dish 1 is in the week
  assertStringIncludes(html, "Add"); // dish 2 is not
});
