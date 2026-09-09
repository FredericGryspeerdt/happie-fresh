import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { IngredientPreviewSheet } from "./IngredientPreviewSheet.tsx";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import type { DishInterface } from "@/models/index.ts";

const rows: IngredientRow[] = [
  {
    itemId: "mince",
    name: "Mince",
    dishNames: ["Lasagne", "Curry"],
    state: "new",
  },
  { itemId: "pasta", name: "Pasta", dishNames: ["Lasagne"], state: "on-list" },
  { itemId: "rice", name: "Rice", dishNames: ["Curry"], state: "bought" },
];
const emptyDishes: DishInterface[] = [
  { id: "d3", name: "Pizza night", ingredientIds: [], tagValueIds: [] },
];
const noop = () => {};
const base = {
  open: true,
  listName: "Weekly shop",
  canChangeList: true,
  onChangeList: noop,
  rows,
  isSelected: (r: IngredientRow) => r.state !== "on-list",
  emptyDishes,
  adding: false,
  onToggle: noop,
  onConfirm: noop,
  onOpenDish: noop,
  onClose: noop,
};

Deno.test("IngredientPreviewSheet — rows, states, empty dishes, and the count button", () => {
  const html = render(h(IngredientPreviewSheet, { ...base, selectedCount: 2 }));
  assertStringIncludes(html, "Add to shopping list");
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "Adding to this list");
  assertStringIncludes(html, ">Change<");
  assertStringIncludes(html, "Mince");
  assertStringIncludes(html, "Lasagne, Curry");
  assertStringIncludes(html, "Already on the list");
  assertStringIncludes(html, "Will be put back · Curry");
  assertStringIncludes(html, "No ingredients yet");
  assertStringIncludes(html, "Pizza night");
  assertStringIncludes(html, "Add 2 items");
});

Deno.test("IngredientPreviewSheet — no Change action when there is only one list", () => {
  const html = render(h(IngredientPreviewSheet, {
    ...base,
    canChangeList: false,
    selectedCount: 2,
  }));
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "Adding to this list");
  assertEquals(html.includes(">Change<"), false);
});

Deno.test("IngredientPreviewSheet — singular label and disabled at zero", () => {
  assertStringIncludes(
    render(h(IngredientPreviewSheet, { ...base, selectedCount: 1 })),
    "Add 1 item",
  );
  const zero = render(h(IngredientPreviewSheet, { ...base, selectedCount: 0 }));
  assertStringIncludes(zero, "Add 0 items");
  // Scoped to the confirm button itself — a bare "includes disabled" check
  // would pass even if some unrelated element carried the attribute.
  assertMatch(
    zero,
    /<button[^>]*disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Add 0 items/,
  );
});

Deno.test("IngredientPreviewSheet — nothing to add message when there are no rows or empty dishes", () => {
  const html = render(h(IngredientPreviewSheet, {
    ...base,
    rows: [],
    emptyDishes: [],
    selectedCount: 0,
  }));
  assertStringIncludes(html, "Nothing to add");
  assertEquals(html.includes("No ingredients yet"), false);
});
