import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h, options } from "preact";
import { QuickLoyaltyCards } from "@/components/cards/QuickLoyaltyCards.tsx";
import Items, { shouldHoldShopWakeLock } from "./items.tsx";

const base = {
  listId: "l1",
  listName: "Test list",
  items: [],
  shoppingList: [],
  categories: [],
  canDelete: true,
  loyaltyCards: [],
};

Deno.test("Items — wake lock is wanted only in Shop mode with open entries", () => {
  assertFalse(shouldHoldShopWakeLock("plan", 1));
  assert(shouldHoldShopWakeLock("shop", 1));
  assertFalse(shouldHoldShopWakeLock("shop", 0));
});

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, "Plannen");
  assertStringIncludes(html, "Winkelen");
});

Deno.test("Items — Plan mode shows the Add items FAB, no quick-add sheet", () => {
  const html = render(h(Items, base));
  assertStringIncludes(html, ">Toevoegen</span>"); // FAB label
  assertFalse(html.includes('aria-label="Klantenkaarten"'));
  assert(!html.includes("Zoek in je catalogus")); // old quick-add sheet gone
});

Deno.test("Items — Shop mode replaces Add items with Loyalty cards", () => {
  const html = render(h(Items, {
    ...base,
    initialMode: "shop",
    loyaltyCards: [],
    items: [{ id: "i1", name: "Milk", categoryId: "c1" }],
    categories: [{ id: "c1", label: "Dairy", order: 0 }],
    shoppingList: [{
      id: "e1",
      listId: "l1",
      itemId: "i1",
      quantity: 1,
      checked: false,
    }],
  }));

  assertStringIncludes(html, 'aria-label="Klantenkaarten"');
  assertFalse(html.includes('aria-label="Producten toevoegen"'));
});

Deno.test("Items — completed Shop mode promotes the loyalty-card action", () => {
  const html = render(h(Items, {
    ...base,
    initialMode: "shop",
    loyaltyCards: [],
    items: [{ id: "i1", name: "Milk", categoryId: "c1" }],
    categories: [{ id: "c1", label: "Dairy", order: 0 }],
    shoppingList: [{
      id: "e1",
      listId: "l1",
      itemId: "i1",
      quantity: 1,
      checked: true,
    }],
  }));

  assertStringIncludes(html, "Klantenkaart tonen");
  assertFalse(html.includes('aria-label="Klantenkaarten"'));
});

Deno.test("Items — mounts the closed quick-card surface with household cards", () => {
  const loyaltyCards = [{
    id: "c1",
    householdId: "h1",
    label: "Delhaize",
    value: "12345678",
    format: "code128" as const,
  }];
  let quickCardProps: Record<string, unknown> | undefined;
  const previousVnode = options.vnode;
  options.vnode = (vnode) => {
    previousVnode?.(vnode);
    if (vnode.type === QuickLoyaltyCards) quickCardProps = vnode.props;
  };

  try {
    render(h(Items, { ...base, loyaltyCards }));
  } finally {
    options.vnode = previousVnode;
  }

  assertEquals(quickCardProps?.cards, loyaltyCards);
  assertEquals(quickCardProps?.open, false);
  assertEquals(typeof quickCardProps?.onClose, "function");
});

Deno.test("Items — canDelete: false hides the Delete list affordance", () => {
  // The list-management sheet's body isn't gated on the sheet being open (see
  // the "!addOpen.value &&" wrapper — Sheet always renders its children), so
  // "Delete list" is present in a cold SSR render whenever canDelete is true,
  // making the false case directly observable here.
  const html = render(h(Items, { ...base, canDelete: false }));
  assertFalse(html.includes("Lijst verwijderen"));
});

Deno.test("Items — list options keeps rename input out of the sheet", () => {
  const html = render(h(Items, base));
  const sheetStart = html.indexOf('aria-label="Lijstopties"');
  const renameDialogStart = html.indexOf('aria-label="Lijstnaam wijzigen"');

  assert(sheetStart >= 0);
  assert(renameDialogStart > sheetStart);
  assertStringIncludes(
    html.slice(sheetStart, renameDialogStart),
    "Lijstnaam wijzigen",
  );
  assertFalse(html.slice(sheetStart, renameDialogStart).includes("<input"));
});

Deno.test("Items — rename dialog uses a text field and form submit", () => {
  const html = render(h(Items, base));
  const renameDialogStart = html.indexOf('aria-label="Lijstnaam wijzigen"');
  const renameDialog = html.slice(renameDialogStart);

  assert(renameDialogStart >= 0);
  assertStringIncludes(renameDialog, "<form");
  assertStringIncludes(renameDialog, 'id="list-name"');
  assertStringIncludes(renameDialog, 'type="submit"');
  assertStringIncludes(renameDialog, ">Annuleren</");
  assertStringIncludes(renameDialog, ">Opslaan</");
});

Deno.test("Items — item editor is a closed dialog without a note field", () => {
  const html = render(h(Items, base));

  assert(
    html.match(/fixed inset-0 z-\[210\] grid place-items-center/g)?.length ===
      5,
  );
  assertFalse(html.includes("<textarea"));
  assertStringIncludes(html, "Deze boodschappenlijst verwijderen?");
  assertStringIncludes(html, "Afgevinkte producten wissen?");
  assertStringIncludes(html, "Van deze lijst verwijderen?");
});
