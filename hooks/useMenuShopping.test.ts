import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { signal } from "@preact/signals";
import { api } from "@/services/api.ts";
import { useMenuShopping } from "@/hooks/useMenuShopping.ts";
import type {
  DishInterface,
  ItemInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";

const items: ItemInterface[] = [
  { id: "pasta", name: "Pasta" },
  { id: "mince", name: "Mince" },
];
const dishes: DishInterface[] = [
  {
    id: "d1",
    name: "Lasagne",
    ingredientIds: ["pasta", "mince"],
    tagValueIds: [],
  },
];
const menuOf = (shoppingListId?: string) =>
  signal<WeeklyMenuInterface>({
    householdId: "h1",
    entries: [{ id: "e1", dishId: "d1", day: null }],
    ...(shoppingListId ? { shoppingListId } : {}),
  });
const list = (id: string): ShoppingListInterface => ({
  id,
  householdId: "h1",
  name: `List ${id}`,
  createdBy: "m1",
  createdAt: "2026-09-08T00:00:00.000Z",
});
const li = (itemId: string, checked: boolean): ShoppingListItemInterface => ({
  id: `li-${itemId}`,
  listId: "A",
  itemId,
  quantity: 1,
  checked,
});

Deno.test("review — one list continues from dish selection and remembers it", async () => {
  const menu = menuOf();
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve({ ...menu.value, shoppingListId: "A" }),
  );
  const hook = useMenuShopping(menu, dishes, items);
  try {
    assertEquals(await hook.start(), true);
    assertEquals(hook.step.value, "dishes");
    await hook.review();
    assertEquals(hook.step.value, "preview");
    assertEquals(hook.chosenList.value?.id, "A");
    assertEquals(getItems.calls[0].args, ["A"]);
    assertEquals(hook.rows.value.map((r) => r.name), ["Mince", "Pasta"]);
    assertEquals(hook.selectedCount.value, 2);
    assertEquals(remember.calls.length, 1);
    await Promise.resolve();
    assertEquals(menu.value.shoppingListId, "A");
    assertEquals(hook.loading.value, false);
  } finally {
    getAllOrNull.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("review — remembered list continues from dish selection", async () => {
  const menu = menuOf("B");
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menu, dishes, items);
  try {
    assertEquals(await hook.start(), true);
    assertEquals(hook.step.value, "dishes");
    await hook.review();
    assertEquals(hook.step.value, "preview");
    assertEquals(hook.chosenList.value?.id, "B");
    assertEquals(getItems.calls[0].args, ["B"]);
    assertEquals(remember.calls.length, 0);
  } finally {
    getAllOrNull.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test('start — a failed fetch does not masquerade as "no lists"', async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    assertEquals(await hook.start(), false);
    assertEquals(hook.step.value, "idle");
    assertEquals(hook.lists.value, []);
  } finally {
    getAllOrNull.restore();
  }
});

Deno.test("review — a dangling remembered list id (not among the fetched lists) opens the picker without it", async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const hook = useMenuShopping(menuOf("gone"), dishes, items);
  try {
    assertEquals(await hook.start(), true);
    assertEquals(hook.step.value, "dishes");
    await hook.review();
    assertEquals(hook.step.value, "pick");
    assertEquals(hook.rememberedListId.value, "gone");
    assertEquals(hook.lists.value.map((l) => l.id), ["A", "B"]);
    assertEquals(
      hook.lists.value.some((l) => l.id === "gone"),
      false,
    );
  } finally {
    getAllOrNull.restore();
  }
});

Deno.test("chooseList — does not re-remember the already remembered list", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf("A"), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(remember.calls.length, 0);
  } finally {
    getItems.restore();
    remember.restore();
  }
});

Deno.test("chooseList — a rejected remember call is swallowed, preview still opens", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.reject(new Error("offline")),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    await new Promise((r) => setTimeout(r, 0)); // let the rejection settle
    assertEquals(hook.step.value, "preview");
    assertEquals(remember.calls.length, 1);
  } finally {
    getItems.restore();
    remember.restore();
  }
});

Deno.test("toggle — allows skipping existing ingredients without changing their stored amount", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([li("pasta", false)]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(hook.selectedCount.value, 2); // existing pasta can receive an additional amount
    hook.toggle("pasta");
    assertEquals(hook.selectedCount.value, 1);
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 0);
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 1);
  } finally {
    getItems.restore();
    remember.restore();
  }
});

Deno.test("confirm — sends only selected rows with dish-name notes and reports the count", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const bulk = stub(
    api.shoppingList,
    "bulkAdd",
    () =>
      Promise.resolve({
        added: [li("mince", false)],
        restored: [],
        skipped: [],
      }),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    hook.toggle("pasta");
    const out = await hook.confirm();
    assertEquals(bulk.calls[0].args.slice(0, 2), ["A", [{
      itemId: "mince",
      note: "Lasagne",
      quantity: 1,
      unit: "pieces",
    }]]);
    assertEquals(out, { count: 1, list: list("A") });
    assertEquals(hook.step.value, "idle");
    assertEquals(hook.adding.value, false);
  } finally {
    getItems.restore();
    remember.restore();
    bulk.restore();
  }
});

Deno.test("confirm — a failed write returns null and keeps the preview open", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const bulk = stub(api.shoppingList, "bulkAdd", () => Promise.resolve(null));
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.chooseList(list("A"));
    assertEquals(await hook.confirm(), null);
    assertEquals(hook.step.value, "preview");
  } finally {
    getItems.restore();
    remember.restore();
    bulk.restore();
  }
});

Deno.test("createList — creates, appends, and continues to the preview", async () => {
  const create = stub(
    api.shoppingLists,
    "create",
    () => Promise.resolve(list("N")),
  );
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    assertEquals(await hook.createList("  "), false);
    assertEquals(create.calls.length, 0);
    assertEquals(await hook.createList(" Groceries "), true);
    assertEquals(create.calls[0].args, ["Groceries"]);
    assertEquals(hook.lists.value.map((l) => l.id), ["N"]);
    assertEquals(hook.step.value, "preview");
    assertEquals(hook.chosenList.value?.id, "N");
  } finally {
    create.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("cancel — first-time picker returns to idle", async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.start();
    await hook.review();
    assertEquals(hook.step.value, "pick");
    hook.cancel();
    assertEquals(hook.step.value, "idle");
  } finally {
    getAllOrNull.restore();
  }
});

Deno.test("changeList — opens the picker keeping the chosen list; cancel returns to the preview", async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.start();
    await hook.review();
    assertEquals(hook.step.value, "preview");
    hook.changeList();
    assertEquals(hook.step.value, "pick");
    assertEquals(hook.chosenList.value?.id, "A");
    hook.cancel();
    assertEquals(hook.step.value, "preview");
  } finally {
    getAllOrNull.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("chooseList — unticked rows survive a list change", async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  const remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  const hook = useMenuShopping(menuOf(), dishes, items);
  try {
    await hook.start();
    await hook.review();
    assertEquals(hook.step.value, "preview");
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 1);
    await hook.chooseList(list("B"));
    assertEquals(hook.selectedCount.value, 1);
    await hook.start();
    await hook.review();
    assertEquals(hook.selectedCount.value, 2);
  } finally {
    getAllOrNull.restore();
    getItems.restore();
    remember.restore();
  }
});

Deno.test("guided draft — dish selection and amounts survive back and destination changes until one confirmed write", async () => {
  const extra = {
    id: "d2",
    name: "Pasta bake",
    ingredientIds: ["pasta"],
    tagValueIds: [],
  };
  const menu = menuOf("A");
  menu.value.entries.push({ id: "e2", dishId: "d2", day: null });
  using _lists = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([]),
  );
  using _remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  using bulk = stub(
    api.shoppingList,
    "bulkAdd",
    () =>
      Promise.resolve({
        added: [li("mince", false)],
        restored: [],
        skipped: [],
      }),
  );
  const flow = useMenuShopping(menu, [...dishes, extra], items);
  await flow.start();
  assertEquals(flow.step.value, "dishes");
  flow.toggleDish("d2");
  await flow.review();
  flow.setAmount("mince", { quantity: 0.5, unit: "kg" });
  flow.toggle("pasta");
  flow.back();
  assertEquals(flow.selectedDishes.value, new Set(["d1"]));
  await flow.review();
  await flow.chooseList(list("B"));
  assertEquals(bulk.calls.length, 0);
  assertEquals(flow.amounts.value.mince, { quantity: 0.5, unit: "kg" });
  await flow.confirm();
  assertEquals(bulk.calls[0].args.slice(0, 2), ["B", [{
    itemId: "mince",
    note: "Lasagne",
    quantity: 0.5,
    unit: "kg",
  }]]);
  await flow.start();
  assertEquals(flow.amounts.value, {});
});

Deno.test("review — failed or stale ingredient fetch preserves draft without opening an empty preview", async () => {
  using _lists = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A")]),
  );
  let finish!: (value: ShoppingListItemInterface[] | null) => void;
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () =>
      new Promise<ShoppingListItemInterface[] | null>((resolve) =>
        finish = resolve
      ),
  );
  const flow = useMenuShopping(menuOf("A"), dishes, items);
  await flow.start();
  const failed = flow.review();
  finish(null);
  assertEquals(await failed, false);
  assertEquals(flow.step.value, "dishes");
  const stale = flow.review();
  flow.cancel();
  finish([]);
  assertEquals(await stale, false);
  assertEquals(flow.step.value, "idle");
});

Deno.test("review — bought duplicates use the same first entry as bulk restoration", async () => {
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () =>
      Promise.resolve([
        {
          ...li("mince", true),
          id: "first",
          quantity: 500,
          unit: "g" as const,
        },
        {
          ...li("mince", true),
          id: "second",
          quantity: 2,
          unit: "kg" as const,
        },
      ]),
  );
  const flow = useMenuShopping(menuOf("A"), dishes, items);
  await flow.chooseList(list("A"));
  assertEquals(flow.reviewAmounts.value.mince, { quantity: 500, unit: "g" });
});

Deno.test("existing ingredient — selects an additional amount and sends it once with a stable retry key", async () => {
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([li("pasta", false)]),
  );
  using _remember = stub(
    api.weeklyMenu,
    "setShoppingList",
    () => Promise.resolve(null),
  );
  let succeed = false;
  using bulk = stub(
    api.shoppingList,
    "bulkAdd",
    () =>
      Promise.resolve(
        succeed
          ? {
            added: [],
            restored: [],
            skipped: [],
            updated: [{ ...li("pasta", false), quantity: 4 }],
          }
          : null,
      ),
  );
  const flow = useMenuShopping(menuOf("A"), dishes, items);
  await flow.chooseList(list("A"));
  assertEquals(flow.selectedCount.value, 2);
  flow.toggle("mince");
  flow.setAmount("pasta", { quantity: 3, unit: "pieces" });
  assertEquals(await flow.confirm(), null);
  // A lost response must not let a different draft masquerade as a retry.
  flow.setAmount("pasta", { quantity: 8, unit: "pieces" });
  succeed = true;
  const result = await flow.confirm();
  assertEquals(bulk.calls[0].args, bulk.calls[1].args);
  assertEquals(result?.count, 1);
});

Deno.test("existing ingredient — incompatible destination units block submission until corrected or skipped", async () => {
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () =>
      Promise.resolve([{
        ...li("pasta", false),
        quantity: 500,
        unit: "g" as const,
      }]),
  );
  using bulk = stub(api.shoppingList, "bulkAdd", () => Promise.resolve(null));
  const flow = useMenuShopping(menuOf("A"), dishes, items);
  await flow.chooseList(list("A"));
  flow.setAmount("pasta", { quantity: 1, unit: "pieces" });
  assertEquals(await flow.confirm(), null);
  assertEquals(bulk.calls.length, 0);
  flow.setAmount("pasta", { quantity: 1, unit: "kg" });
  assertEquals(flow.amountError.value, null);
  flow.toggle("pasta");
  await flow.confirm();
  assertEquals(bulk.calls[0].args[1].map((i) => i.itemId), ["mince"]);
});

Deno.test("definite rejection — reloads existing amount while keeping editable additions", async () => {
  let quantity = 1;
  using _entries = stub(
    api.shoppingList,
    "getItemsOrNull",
    () => Promise.resolve([{ ...li("pasta", false), quantity }]),
  );
  using _bulk = stub(
    api.shoppingList,
    "bulkAdd",
    () => Promise.resolve({ error: "List changed" }),
  );
  const flow = useMenuShopping(menuOf("A"), dishes, items);
  await flow.chooseList(list("A"));
  flow.setAmount("pasta", { quantity: 3, unit: "pieces" });
  quantity = 2;
  await flow.confirm();
  assertEquals(flow.draftLocked.value, false);
  assertEquals(
    flow.rows.value.find((r) => r.itemId === "pasta")?.existingAmount?.quantity,
    2,
  );
  assertEquals(flow.reviewAmounts.value.pasta.quantity, 3);
  assertEquals(flow.submissionMessage.value, "List changed");
});
