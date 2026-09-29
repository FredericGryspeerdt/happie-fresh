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
  assertStringIncludes(html, "Al toegevoegd");
  assertStringIncludes(html, 'aria-label="Verwijderen Tomato"');
  assertFalse(html.includes("Nieuw ingrediënt toevoegen:"));
  assertFalse(html.includes('aria-label="Toevoegen Basil"'));
});

Deno.test("ingredient search puts accessible matches before the create action", () => {
  const html = render(h(IngredientPicker, { ...props, query: " Basi " }));
  assertStringIncludes(html, 'aria-label="Toevoegen Basil"');
  assert(
    html.indexOf('aria-label="Toevoegen Basil"') <
      html.indexOf("Nieuw ingrediënt toevoegen:"),
  );
  assertStringIncludes(html, "Basi");
});

Deno.test("empty ingredient search browses the catalogue without offering an empty creation", () => {
  const html = render(h(IngredientPicker, { ...props, query: "  " }));
  assertStringIncludes(html, 'aria-label="Toevoegen Basil"');
  assertFalse(html.includes("Nieuw ingrediënt toevoegen:"));
});

Deno.test("empty catalogue explains how to start instead of showing a blank picker", () => {
  const html = render(
    h(IngredientPicker, { ...props, items: [], selectedIds: [] }),
  );
  assertStringIncludes(html, "Typ de naam van een ingrediënt om te beginnen.");
  assertStringIncludes(html, 'aria-label="Ingrediënten zoeken"');
});
