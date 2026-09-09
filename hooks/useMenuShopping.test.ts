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

Deno.test("start — one list goes straight to the preview and remembers it", async () => {
  const menu = menuOf();
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItems",
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

Deno.test("start — remembered list that still exists goes straight to the preview", async () => {
  const menu = menuOf("B");
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const getItems = stub(
    api.shoppingList,
    "getItems",
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

Deno.test("start — a dangling remembered list id (not among the fetched lists) opens the picker without it", async () => {
  const getAllOrNull = stub(
    api.shoppingLists,
    "getAllOrNull",
    () => Promise.resolve([list("A"), list("B")]),
  );
  const hook = useMenuShopping(menuOf("gone"), dishes, items);
  try {
    assertEquals(await hook.start(), true);
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
    "getItems",
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
    "getItems",
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

Deno.test("toggle — flips new/bought rows, ignores on-list rows", async () => {
  const getItems = stub(
    api.shoppingList,
    "getItems",
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
    assertEquals(hook.selectedCount.value, 1); // pasta is on-list
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
    "getItems",
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
    assertEquals(bulk.calls[0].args, ["A", [{
      itemId: "mince",
      note: "Lasagne",
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
    "getItems",
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
    "getItems",
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
    "getItems",
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
    "getItems",
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
    assertEquals(hook.step.value, "preview");
    hook.toggle("mince");
    assertEquals(hook.selectedCount.value, 1);
    await hook.chooseList(list("B"));
    assertEquals(hook.selectedCount.value, 1);
    await hook.start();
    assertEquals(hook.selectedCount.value, 2);
  } finally {
    getAllOrNull.restore();
    getItems.restore();
    remember.restore();
  }
});
