import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Catalogue from "./catalogue.tsx";

Deno.test("Catalogue — renders segmented, categories, selected items, add tile", () => {
  const html = render(h(Catalogue, {
    initialItems: [
      { id: "i1", name: "Butter", categoryId: "d" },
      { id: "i2", name: "Bread", categoryId: "b" },
    ],
    initialCategories: [
      { id: "d", label: "Dairy", order: 0 },
      { id: "b", label: "Bakery", order: 1 },
    ],
  }));
  assertStringIncludes(html, "Lists");
  assertStringIncludes(html, "Catalogue");
  assertStringIncludes(html, "Bakery"); // alphabetical-first → selected by default
  assertStringIncludes(html, "Bread"); // item in the selected (Bakery) category
  assertStringIncludes(html, "Add item");
  assertStringIncludes(html, "Add item or category"); // FAB speed-dial primary
});

Deno.test("Catalogue — shows an Uncategorized chip when uncategorized items exist", () => {
  const html = render(h(Catalogue, {
    initialItems: [{ id: "i1", name: "Salt" }],
    initialCategories: [{ id: "d", label: "Dairy", order: 0 }],
  }));
  assertStringIncludes(html, "Uncategorized");
});
