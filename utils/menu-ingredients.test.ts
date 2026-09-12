import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { collectIngredients, noteFor } from "@/utils/menu-ingredients.ts";
import type {
  DishInterface,
  ItemInterface,
  MenuEntryInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";

const items: ItemInterface[] = [
  { id: "pasta", name: "pasta" },
  { id: "mince", name: "Mince" },
  { id: "rice", name: "rice" },
  { id: "curry", name: "Curry paste" },
];
const dishes: DishInterface[] = [
  {
    id: "d1",
    name: "Lasagne",
    ingredientIds: ["pasta", "mince"],
    tagValueIds: [],
  },
  {
    id: "d2",
    name: "Curry",
    ingredientIds: ["rice", "curry", "mince"],
    tagValueIds: [],
  },
  { id: "d3", name: "Pizza night", ingredientIds: [], tagValueIds: [] },
  { id: "d4", name: "Ghost", ingredientIds: ["gone"], tagValueIds: [] },
];
const entries: MenuEntryInterface[] = [
  { id: "e1", dishId: "d1", day: "Mon" },
  { id: "e2", dishId: "d2", day: null },
  { id: "e3", dishId: "d3", day: null },
  { id: "e4", dishId: "d4", day: null },
  { id: "e5", dishId: "deleted-dish", day: null },
];
const li = (
  itemId: string,
  checked: boolean,
  id = crypto.randomUUID(),
): ShoppingListItemInterface => ({
  id,
  listId: "L",
  itemId,
  quantity: 1,
  checked,
});

Deno.test("collectIngredients — dedups across dishes, sorts case-insensitively, keeps dish order in dishNames", () => {
  const { rows } = collectIngredients(entries, dishes, items, []);
  assertEquals(rows.map((r) => r.name), [
    "Curry paste",
    "Mince",
    "pasta",
    "rice",
  ]);
  assertEquals(rows.find((r) => r.itemId === "mince")!.dishNames, [
    "Lasagne",
    "Curry",
  ]);
  assertEquals(rows.every((r) => r.state === "new"), true);
});

Deno.test("collectIngredients — states come from the target list", () => {
  const { rows } = collectIngredients(entries, dishes, items, [
    li("pasta", false),
    li("rice", true),
  ]);
  const state = (id: string) => rows.find((r) => r.itemId === id)!.state;
  assertEquals(state("pasta"), "on-list");
  assertEquals(state("rice"), "bought");
  assertEquals(state("mince"), "new");
});

Deno.test("collectIngredients — an unchecked list entry beats a checked duplicate", () => {
  const { rows } = collectIngredients(entries, dishes, items, [
    li("pasta", true),
    li("pasta", false),
  ]);
  assertEquals(rows.find((r) => r.itemId === "pasta")!.state, "on-list");
});

Deno.test("collectIngredients — dangling items are skipped; dishes with nothing resolvable are empty; unknown dishes vanish", () => {
  const { rows, emptyDishes } = collectIngredients(entries, dishes, items, []);
  assertEquals(rows.some((r) => r.itemId === "gone"), false);
  assertEquals(emptyDishes.map((d) => d.name), ["Pizza night", "Ghost"]);
});

Deno.test("collectIngredients — empty menu yields nothing", () => {
  assertEquals(collectIngredients([], dishes, items, []), {
    rows: [],
    emptyDishes: [],
  });
});

Deno.test("noteFor — joins dish names with a comma", () => {
  assertEquals(
    noteFor({
      itemId: "x",
      name: "x",
      dishNames: ["Lasagne", "Curry"],
      state: "new",
    }),
    "Lasagne, Curry",
  );
});
