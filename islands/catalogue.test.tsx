import {
  assert,
  assertFalse,
  assertMatch,
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
  assertStringIncludes(html, "Lijsten");
  assertStringIncludes(html, "Catalogus");
  assertStringIncludes(html, "Bakery"); // alphabetical-first → selected by default
  assertStringIncludes(html, "Bread"); // item in the selected (Bakery) category
  assertStringIncludes(html, "Product toevoegen");
  assertStringIncludes(html, "Product of categorie toevoegen"); // FAB speed-dial primary
  assertStringIncludes(html, "Categorie verwijderen"); // canDelete: true exposes it
  assertStringIncludes(html, "Uit de catalogus verwijderen?");
  assertStringIncludes(html, "Deze categorie verwijderen?");
});

Deno.test("Catalogue — shows an Uncategorized chip when uncategorized items exist", () => {
  const html = render(h(Catalogue, {
    canDelete: true,
    initialItems: [{ id: "i1", name: "Salt" }],
    initialCategories: [{ id: "d", label: "Dairy", order: 0 }],
  }));
  assertStringIncludes(html, "Zonder categorie");
});

Deno.test("Catalogue — canDelete: false hides the category delete affordance", () => {
  // The category dialog's body isn't gated on the dialog being open (see
  // CategoryMenuDialog — Dialog always renders its children), so its Delete
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
  assertFalse(html.includes("Categorie verwijderen"));
});

Deno.test("Catalogue — edits a category in a dialog with a labelled field", () => {
  const html = render(h(Catalogue, {
    canDelete: true,
    initialItems: [],
    initialCategories: [{ id: "d", label: "Dairy", order: 0 }],
  }));

  assertMatch(
    html,
    /aria-label="Categorie"[^>]*class="[^"]*bg-surface-chigh/,
  );
  assertStringIncludes(html, 'for="category-name"');
  assertStringIncludes(html, 'id="category-name"');
});

Deno.test("Catalogue — canDelete: false hides Remove from catalogue in the edit-item dialog", () => {
  // EditItemDialog's body, like CategoryMenuDialog's, isn't gated on the dialog
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
  assertFalse(html.includes("Uit catalogus verwijderen"));
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
  const editDialogStart = html.indexOf('aria-label="Product bewerken"');

  assert(editDialogStart >= 0);
  const editDialog = html.slice(
    editDialogStart,
    html.indexOf('class="fixed inset-0', editDialogStart),
  );
  assertStringIncludes(editDialog, "max-w-[560px]");
  assertStringIncludes(editDialog, 'id="catalogue-item-name"');
  assertStringIncludes(editDialog, ">Annuleren</button>");
  assertStringIncludes(editDialog, ">Opslaan</button>");
  assertFalse(editDialog.includes("translateY"));
});
