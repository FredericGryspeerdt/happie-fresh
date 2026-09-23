import {
  assert,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
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
  assertStringIncludes(html, "Remove from the catalogue?");
  assertStringIncludes(html, "Delete this category?");
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

Deno.test("Catalogue — canDelete: false hides Remove from catalogue in the edit-item dialog", () => {
  // EditItemDialog's body, like CategoryMenuSheet's, isn't gated on the dialog
  // being open (Dialog always renders its children) or on `item` being
  // non-null, so "Remove from catalogue" is present in a cold SSR render
  // whenever canDelete is true — the false case is directly observable here too.
  const html = render(h(Catalogue, {
    canDelete: false,
    initialItems: [
      { id: "i1", name: "Butter", categoryId: "d" },
    ],
    initialCategories: [
      { id: "d", label: "Dairy", order: 0 },
    ],
  }));
  assertFalse(html.includes("Remove from catalogue"));
});

Deno.test("Catalogue — edits an item in a basic dialog with a TextField", () => {
  const html = render(h(Catalogue, {
    canDelete: true,
    initialItems: [
      { id: "i1", name: "Butter", categoryId: "d" },
    ],
    initialCategories: [
      { id: "d", label: "Dairy", order: 0 },
    ],
  }));
  const editDialogStart = html.indexOf('aria-label="Edit item"');

  assert(editDialogStart >= 0);
  const editDialog = html.slice(editDialogStart, editDialogStart + 2500);
  assertStringIncludes(editDialog, "max-w-[560px]");
  assertStringIncludes(editDialog, 'id="catalogue-item-name"');
  assertStringIncludes(editDialog, ">Cancel</button>");
  assertStringIncludes(editDialog, ">Save</button>");
  assertFalse(editDialog.includes("translateY"));
});
