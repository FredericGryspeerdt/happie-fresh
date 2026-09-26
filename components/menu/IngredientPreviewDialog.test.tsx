import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { IngredientPreviewDialog } from "./IngredientPreviewDialog.tsx";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import type { DishInterface } from "@/models/index.ts";

const rows: IngredientRow[] = [
  {
    itemId: "mince",
    name: "Mince",
    dishNames: ["Lasagne", "Curry"],
    requirements: [],
    missingDishNames: [],
    state: "new",
  },
  {
    itemId: "pasta",
    name: "Pasta",
    dishNames: ["Lasagne"],
    requirements: [],
    missingDishNames: [],
    state: "on-list",
    existingAmount: { quantity: 1, unit: "pieces" },
  },
  {
    itemId: "rice",
    name: "Rice",
    dishNames: ["Curry"],
    requirements: [],
    missingDishNames: [],
    state: "bought",
  },
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
  onBack: noop,
  dishCount: 2,
  categories: [{ id: "fridge", label: "Fridge" }],
  items: [{ id: "mince", name: "Mince", categoryId: "fridge" }],
  amounts: {},
  onAmount: noop,
};

Deno.test("IngredientPreviewDialog — rows, states, empty dishes, and the count button", () => {
  const html = render(
    h(IngredientPreviewDialog, { ...base, selectedCount: 2 }),
  );
  assertStringIncludes(html, "Check your cupboards");
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "Adding to");
  assertStringIncludes(html, ">Change<");
  assertStringIncludes(html, "Mince");
  assertStringIncludes(html, "Lasagne · Curry");
  assertStringIncludes(html, "Already on your list:");
  assertStringIncludes(html, "Buy again · Curry");
  assertStringIncludes(html, "No ingredients yet");
  assertStringIncludes(html, "Pizza night");
  assertStringIncludes(html, "Add 2 items");
});

Deno.test("IngredientPreviewDialog — no Change action when there is only one list", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    canChangeList: false,
    selectedCount: 2,
  }));
  assertStringIncludes(html, "Weekly shop");
  assertStringIncludes(html, "Adding to");
  assertEquals(html.includes(">Change<"), false);
});

Deno.test("IngredientPreviewDialog — singular label and disabled at zero", () => {
  assertStringIncludes(
    render(h(IngredientPreviewDialog, { ...base, selectedCount: 1 })),
    "Add 1 item",
  );
  const zero = render(
    h(IngredientPreviewDialog, { ...base, selectedCount: 0 }),
  );
  assertStringIncludes(zero, "Add 0 items");
  // Scoped to the confirm button itself — a bare "includes disabled" check
  // would pass even if some unrelated element carried the attribute.
  assertMatch(
    zero,
    /<button[^>]*disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Add 0 items/,
  );
});

Deno.test("IngredientPreviewDialog — nothing to add message when there are no rows or empty dishes", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    rows: [],
    emptyDishes: [],
    selectedCount: 0,
  }));
  assertStringIncludes(html, "Nothing to add");
  assertEquals(html.includes("No ingredients yet"), false);
});

Deno.test("existing ingredients — show editable additional amount and combined total", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    rows: [{
      itemId: "carrot",
      name: "Carrots",
      dishNames: ["Soup"],
      requirements: [],
      missingDishNames: [],
      state: "on-list",
      existingAmount: { quantity: 1, unit: "pieces" },
    }],
    isSelected: () => true,
    amounts: { carrot: { quantity: 3, unit: "pieces" } },
    selectedCount: 1,
  }));
  assertStringIncludes(html, "Already on your list: 1");
  assertStringIncludes(html, "Total after adding: 4");
  assertStringIncludes(html, 'aria-label="Edit amount for Carrots"');
  assertStringIncludes(html, "Add 3");
});

Deno.test("conflicting and missing dish amounts are shown, and an unresolved selected amount blocks adding", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    rows: [{
      itemId: "tomato",
      name: "Tomatoes",
      dishNames: ["Lasagne", "Soup", "Salad"],
      requirements: [
        { dishName: "Lasagne", amount: { quantity: 200, unit: "g" } },
        { dishName: "Soup", amount: { quantity: 2, unit: "pieces" } },
        { dishName: "Salad" },
      ],
      missingDishNames: ["Salad"],
      amountIssue: "incompatible",
      state: "new",
    }],
    amounts: {},
    selectedCount: 1,
    invalidAmount: true,
  }));
  assertStringIncludes(html, "Lasagne: 200 g");
  assertStringIncludes(html, "Soup: 2");
  assertStringIncludes(html, "Amount not set for Salad");
  assertStringIncludes(html, "Choose one amount for these dishes");
  assertStringIncludes(html, "Choose amount");
  assertStringIncludes(html, 'aria-label="Edit amount for Tomatoes"');
  assertStringIncludes(html, "min-h-12");
  assertMatch(html, /<button[^>]*disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Add 1 item/);
});

Deno.test("submission failure remains visible in the review dialog", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    selectedCount: 1,
    message: "We couldn't confirm the addition. Retry to check it safely.",
  }));
  assertMatch(html, /<p[^>]*role="alert"[^>]*>/);
  assertStringIncludes(html, "We couldn't confirm the addition");
});

Deno.test("an unchecked entry with an incompatible dish amount shows both and asks for a compatible addition", () => {
  const html = render(h(IngredientPreviewDialog, {
    ...base,
    rows: [{
      itemId: "tomato",
      name: "Tomatoes",
      dishNames: ["Salad"],
      requirements: [{
        dishName: "Salad",
        amount: { quantity: 500, unit: "g" },
      }],
      missingDishNames: [],
      suggestedAmount: { quantity: 500, unit: "g" },
      state: "on-list",
      existingAmount: { quantity: 2, unit: "pieces" },
    }],
    amounts: { tomato: { quantity: 500, unit: "g" } },
    isSelected: () => true,
    selectedCount: 1,
  }));
  assertStringIncludes(html, "Salad: 500 g");
  assertStringIncludes(html, "Already on your list: 2");
  assertStringIncludes(html, "Choose a compatible amount");
});
