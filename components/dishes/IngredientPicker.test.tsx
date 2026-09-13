import {
  assert,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { IngredientPicker } from "./IngredientPicker.tsx";

const items = [
  { id: "tomato", name: "Tomato" },
  { id: "pasta", name: "Pasta" },
  { id: "basil", name: "Basil" },
];
const props = {
  items,
  selectedIds: ["tomato", "pasta"],
  dishName: "Tomato pasta",
  query: "",
  inputRef: { current: null },
  creating: false,
  onQuery: () => {},
  onReset: () => {},
  onAdd: () => {},
  onRemove: () => {},
  onCreate: () => {},
};

Deno.test("ingredient search keeps matching selections visible and prevents duplicate creation", () => {
  const html = render(h(IngredientPicker, { ...props, query: "  TOMATO  " }));
  assertStringIncludes(html, "Already added");
  assertStringIncludes(html, 'aria-label="Remove Tomato"');
  assertFalse(html.includes("Add new ingredient"));
  assertFalse(html.includes('aria-label="Add Basil"'));
});

Deno.test("ingredient search puts accessible matches before the create action", () => {
  const html = render(h(IngredientPicker, { ...props, query: " Basi " }));
  assertStringIncludes(html, 'aria-label="Add Basil"');
  assert(
    html.indexOf('aria-label="Add Basil"') < html.indexOf("Add new ingredient"),
  );
  assertStringIncludes(html, "Basi");
});

Deno.test("empty ingredient search browses the catalogue without offering an empty creation", () => {
  const html = render(h(IngredientPicker, { ...props, query: "  " }));
  assertStringIncludes(html, 'aria-label="Add Basil"');
  assertFalse(html.includes("Add new ingredient"));
});

Deno.test("empty catalogue explains how to start instead of showing a blank picker", () => {
  const html = render(
    h(IngredientPicker, { ...props, items: [], selectedIds: [] }),
  );
  assertStringIncludes(html, "Type an ingredient name to get started.");
  assertStringIncludes(html, 'aria-label="Search ingredients"');
});
