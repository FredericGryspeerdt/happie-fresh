import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { CatalogueAddRow } from "./CatalogueAddRow.tsx";

Deno.test("CatalogueAddRow — name, category, and Add affordance", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Butter",
    categoryLabel: "Dairy",
    added: false,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Butter");
  assertStringIncludes(html, "Dairy");
  assert(!html.includes("Added"));
});

Deno.test("CatalogueAddRow — Added state", () => {
  const html = render(h(CatalogueAddRow, {
    name: "Bread",
    added: true,
    onAdd: () => {},
  }));
  assertStringIncludes(html, "Bread");
  assertStringIncludes(html, "Added");
});
