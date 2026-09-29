import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DishCatalogue, { confirmDishRemoval } from "./DishCatalogue.tsx";

Deno.test("DishCatalogue — failed removal keeps the dialog open and reports failure", async () => {
  let closed = false;
  let message = "";

  await confirmDishRemoval(
    "dish-1",
    () => Promise.resolve(false),
    () => (closed = true),
    (next) => (message = next),
  );

  assertEquals(closed, false);
  assertEquals(
    message,
    "Het gerecht verwijderen is niet gelukt — probeer opnieuw",
  );
});

Deno.test("DishCatalogue — renders dishes, search, and the add FAB", () => {
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
  assertStringIncludes(html, "Gerechten zoeken"); // search kept
  assertStringIncludes(html, "Gerecht toevoegen"); // FAB label
});

Deno.test("DishCatalogue — empty state prompts adding a dish", () => {
  const html = render(h(DishCatalogue, {
    initialDishes: [],
    initialTagGroups: [],
  }));
  assertStringIncludes(html, "Nog geen gerechten");
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
  assertStringIncludes(html, "Toegevoegd"); // dish 1 is in the week
  // "Add" is a substring of "Added", so a plain includes() check here is
  // trivially satisfied by dish 1 alone — count exact label matches instead
  // to prove dish 2 renders the un-planned "Add" label.
  assertEquals((html.match(/>Toegevoegd</g) || []).length, 1);
  assertEquals((html.match(/>Toevoegen</g) || []).length, 1);
  assertStringIncludes(html, "Uit deze week verwijderen?");
});
