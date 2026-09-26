import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { CatalogueAddRow } from "./CatalogueAddRow.tsx";

Deno.test("CatalogueAddRow — un-added: name, category, Add affordance", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Butter",
    categoryLabel: "Dairy",
    added: false,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Butter");
  assertStringIncludes(html, "Dairy");
  assert(!html.includes("Hoeveelheid verlagen")); // no stepper when un-added
  assert(!html.includes("Toegevoegd")); // un-added row never shows the Added affordance
});

Deno.test("CatalogueAddRow — added: inline quantity stepper", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Bread",
    added: true,
    onAdd: () => {},
    quantity: 2,
    onQtyChange: () => {},
    onEdit: () => {},
  }));
  assertStringIncludes(html, "Bread");
  assertStringIncludes(html, "Hoeveelheid verlagen"); // Stepper present
  assertStringIncludes(html, "Hoeveelheid verhogen");
});

Deno.test("CatalogueAddRow — added with onRemove shows a remove control", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Milk",
    added: true,
    onAdd: () => {},
    quantity: 1,
    onQtyChange: () => {},
    onEdit: () => {},
    onRemove: () => {},
  }));
  assertStringIncludes(html, "Verwijderen Milk");
});

// Defensive fallback: no current caller exercises this path (the sole caller,
// islands/add-items.tsx, always passes quantity/onEdit alongside added). With no
// quantity/onQtyChange/onEdit the row must still fall back to a static "✓ Added"
// label and stay inert — ListItem renders a plain <div> (no "md-press" host) when
// it has no onClick, whereas the interactive path wraps body in a Pressable. This
// test guards that contract so the static fallback keeps working if a future
// caller (or this one) ever omits quantity.
Deno.test("CatalogueAddRow — added fallback: static Added label, inert, no stepper/remove", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Eggs",
    added: true,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Toegevoegd"); // static fallback label
  assert(!html.includes("Hoeveelheid verlagen")); // no stepper
  assert(!html.includes("Verwijderen ")); // no remove control
  assert(!html.includes("md-press")); // inert: no interactive Pressable wrapper
});
