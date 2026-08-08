import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Catalogue from "./catalogue.tsx";

Deno.test("Catalogue — renders segmented, categories, selected items, add tile", () => {
  const html = render(h(Catalogue, {
    canDelete: true,
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
  assertStringIncludes(html, "Delete category"); // canDelete: true exposes it
});

Deno.test("Catalogue — shows an Uncategorized chip when uncategorized items exist", () => {
  const html = render(h(Catalogue, {
    canDelete: true,
    initialItems: [{ id: "i1", name: "Salt" }],
    initialCategories: [{ id: "d", label: "Dairy", order: 0 }],
  }));
  assertStringIncludes(html, "Uncategorized");
});

Deno.test("Catalogue — canDelete: false hides the category delete affordance", () => {
  // The category menu sheet's body isn't gated on the sheet being open (see
  // CategoryMenuSheet — Sheet always renders its children), so its Delete
  // button is present in a cold SSR render whenever canDelete is true, and
  // this is the one island where the false case is directly observable.
  const html = render(h(Catalogue, {
    canDelete: false,
    initialItems: [
      { id: "i1", name: "Butter", categoryId: "d" },
    ],
    initialCategories: [
      { id: "d", label: "Dairy", order: 0 },
    ],
  }));
  assertFalse(html.includes("Delete category"));
});
