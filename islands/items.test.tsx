import {
  assert,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

const base = {
  listId: "l1",
  listName: "Test list",
  items: [],
  shoppingList: [],
  categories: [],
  canDelete: true,
};

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});

Deno.test("Items — Plan mode shows the Add items FAB, no quick-add sheet", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Add items"); // FAB label
  assert(!html.includes("Search your catalogue")); // old quick-add sheet gone
});

Deno.test("Items — canDelete: false hides the Delete list affordance", () => {
  // The list-management sheet's body isn't gated on the sheet being open (see
  // the "!addOpen.value &&" wrapper — Sheet always renders its children), so
  // "Delete list" is present in a cold SSR render whenever canDelete is true,
  // making the false case directly observable here.
  const html = render(h(Items, { ...base, canDelete: false }));
  assertFalse(html.includes("Delete list"));
});

Deno.test("Items — list options keeps rename input out of the sheet", () => {
  const html = render(h(Items, base));
  const sheetStart = html.indexOf('aria-label="List options"');
  const renameDialogStart = html.indexOf('aria-label="Rename list"');

  assert(sheetStart >= 0);
  assert(renameDialogStart > sheetStart);
  assertStringIncludes(
    html.slice(sheetStart, renameDialogStart),
    "Rename list",
  );
  assertFalse(html.slice(sheetStart, renameDialogStart).includes("<input"));
});

Deno.test("Items — rename dialog uses a text field and form submit", () => {
  const html = render(h(Items, base));
  const renameDialogStart = html.indexOf('aria-label="Rename list"');
  const renameDialog = html.slice(renameDialogStart);

  assert(renameDialogStart >= 0);
  assertStringIncludes(renameDialog, "<form");
  assertStringIncludes(renameDialog, 'id="list-name"');
  assertStringIncludes(renameDialog, 'type="submit"');
  assertStringIncludes(renameDialog, ">Cancel</");
  assertStringIncludes(renameDialog, ">Save</");
});
