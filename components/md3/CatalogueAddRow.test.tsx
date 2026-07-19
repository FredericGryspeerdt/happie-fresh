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
  assert(!html.includes("Decrease quantity")); // no stepper when un-added
  assert(!html.includes("Added")); // un-added row never shows the Added affordance
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
  assertStringIncludes(html, "Decrease quantity"); // Stepper present
  assertStringIncludes(html, "Increase quantity");
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
  assertStringIncludes(html, "Remove Milk");
});

// Backward-compat: both real callers pass only { name, added, onAdd }. With no
// quantity/onQtyChange/onEdit the row must fall back to a static "✓ Added" label
// and stay inert — ListItem renders a plain <div> (no "md-press" host) when it
// has no onClick, whereas the interactive path wraps body in a Pressable.
Deno.test("CatalogueAddRow — added fallback: static Added label, inert, no stepper/remove", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Eggs",
    added: true,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Added"); // static fallback label
  assert(!html.includes("Decrease quantity")); // no stepper
  assert(!html.includes("Remove ")); // no remove control
  assert(!html.includes("md-press")); // inert: no interactive Pressable wrapper
});
