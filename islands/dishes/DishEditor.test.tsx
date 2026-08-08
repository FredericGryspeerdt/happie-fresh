import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DishEditor from "./DishEditor.tsx";

const groups = [{
  id: "type",
  label: "Type",
  order: 0,
  values: [{ id: "veg", label: "Vegetarian" }],
}];
const items = [{ id: "a", name: "Onion" }];

Deno.test("DishEditor — new dish renders name, tags, add-ingredient, create button", () => {
  const html = render(h(DishEditor, {
    tagGroups: groups,
    items,
    canDelete: true,
  }));
  assertStringIncludes(html, "Name");
  assertStringIncludes(html, "Type"); // tag group label
  assertStringIncludes(html, "Vegetarian"); // tag value chip
  assertStringIncludes(html, "Add ingredient");
  assertStringIncludes(html, "Create dish");
});

Deno.test("DishEditor — existing dish prefills name, shows ingredient chip + delete", () => {
  const html = render(h(DishEditor, {
    dish: {
      id: "1",
      name: "Pasta",
      ingredientIds: ["a"],
      tagValueIds: ["veg"],
    },
    tagGroups: groups,
    items,
    canDelete: true,
  }));
  assertStringIncludes(html, 'value="Pasta"'); // prefilled name field
  assertStringIncludes(html, "Onion"); // resolved ingredient chip
  assertStringIncludes(html, "Save changes");
  assertStringIncludes(html, "Delete dish");
});

Deno.test("DishEditor — canDelete: false hides Delete dish even for an existing dish", () => {
  const html = render(h(DishEditor, {
    dish: {
      id: "1",
      name: "Pasta",
      ingredientIds: ["a"],
      tagValueIds: ["veg"],
    },
    tagGroups: groups,
    items,
    canDelete: false,
  }));
  assertStringIncludes(html, "Save changes"); // editor itself still renders
  assertFalse(html.includes("Delete dish"));
});
