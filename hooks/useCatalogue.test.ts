import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useCatalogue } from "@/hooks/useCatalogue.ts";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";

const item = (
  id: string,
  name: string,
  categoryId?: string,
): ItemInterface => ({
  id,
  name,
  categoryId,
});
const cat = (id: string, label: string, order = 0): CategoryInterface => ({
  id,
  label,
  order,
});

Deno.test("sortedCategories — alphabetical by label (case-insensitive)", () => {
  const hook = useCatalogue([], [
    cat("b", "bakery"),
    cat("a", "Apples"),
    cat("c", "Dairy"),
  ]);
  assertEquals(hook.sortedCategories.value.map((c) => c.label), [
    "Apples",
    "bakery",
    "Dairy",
  ]);
});

Deno.test("itemsForCategory — filters by id and sorts by name", () => {
  const hook = useCatalogue(
    [
      item("i2", "Yoghurt", "d"),
      item("i1", "Butter", "d"),
      item("i3", "Bread", "b"),
    ],
    [cat("d", "Dairy"), cat("b", "Bakery")],
  );
  assertEquals(hook.itemsForCategory("d").map((i) => i.name), [
    "Butter",
    "Yoghurt",
  ]);
});

Deno.test("itemsForCategory(undefined) — includes no-category and dangling-category items", () => {
  const hook = useCatalogue(
    [
      item("i1", "Salt"),
      item("i2", "Milk", "d"),
      item("i3", "Mystery", "gone"),
    ],
    [cat("d", "Dairy")],
  );
  assertEquals(hook.itemsForCategory(undefined).map((i) => i.name), [
    "Mystery",
    "Salt",
  ]);
  assertEquals(hook.hasUncategorized.value, true);
});

Deno.test("itemNames — lowercased set for duplicate detection", () => {
  const hook = useCatalogue([item("i1", "Butter")], []);
  assertEquals(hook.itemNames.value.has("butter"), true);
});

Deno.test("addItem — creates via API, appends, returns id", async () => {
  using _c = stub(
    api.items,
    "create",
    () => Promise.resolve(item("new", "Cheese", "d")),
  );
  const hook = useCatalogue([], [cat("d", "Dairy")]);
  const id = await hook.addItem("Cheese", "d");
  assertEquals(id, "new");
  assertEquals(hook.items.value.map((i) => i.name), ["Cheese"]);
});

Deno.test("addItem — blank name returns null and calls nothing", async () => {
  const hook = useCatalogue([], []);
  assertEquals(await hook.addItem("   "), null);
  assertEquals(hook.items.value.length, 0);
});

Deno.test("renameItem — optimistic rename, calls update with existing categoryId", async () => {
  const calls: Array<[string, string, string | undefined]> = [];
  using _u = stub(api.items, "update", (id, name, categoryId) => {
    calls.push([id, name, categoryId]);
    return Promise.resolve(
      item(id, name, categoryId) as Required<ItemInterface>,
    );
  });
  const hook = useCatalogue([item("i1", "Buttr", "d")], [cat("d", "Dairy")]);
  await hook.renameItem("i1", "Butter");
  assertEquals(hook.items.value[0].name, "Butter");
  assertEquals(calls[0], ["i1", "Butter", "d"]);
});

Deno.test("moveItem — optimistic move, calls update with existing name", async () => {
  const calls: Array<[string, string, string | undefined]> = [];
  using _u = stub(api.items, "update", (id, name, categoryId) => {
    calls.push([id, name, categoryId]);
    return Promise.resolve(
      item(id, name, categoryId) as Required<ItemInterface>,
    );
  });
  const hook = useCatalogue([item("i1", "Butter", "d")], [
    cat("d", "Dairy"),
    cat("b", "Bakery"),
  ]);
  await hook.moveItem("i1", "b");
  assertEquals(hook.items.value[0].categoryId, "b");
  assertEquals(calls[0], ["i1", "Butter", "b"]);
});

Deno.test("removeItem — optimistic remove, calls delete", async () => {
  const calls: string[] = [];
  using _d = stub(api.items, "delete", (id) => {
    calls.push(id);
    return Promise.resolve();
  });
  const hook = useCatalogue([item("i1", "Butter")], []);
  await hook.removeItem("i1");
  assertEquals(hook.items.value.length, 0);
  assertEquals(calls, ["i1"]);
});

Deno.test("createCategory — creates via API and appends", async () => {
  using _c = stub(
    api.categories,
    "create",
    () => Promise.resolve(cat("new", "Frozen", 3)),
  );
  const hook = useCatalogue([], []);
  const created = await hook.createCategory("Frozen");
  assertEquals(created?.label, "Frozen");
  assertEquals(hook.categories.value.length, 1);
});

Deno.test("deleteCategory — removes category; its items become uncategorized", async () => {
  using _d = stub(api.categories, "delete", () => Promise.resolve());
  const hook = useCatalogue([item("i1", "Milk", "d")], [cat("d", "Dairy")]);
  await hook.deleteCategory("d");
  assertEquals(hook.categories.value.length, 0);
  assertEquals(hook.itemsForCategory(undefined).map((i) => i.name), ["Milk"]);
});

Deno.test("pendingCount — returns to 0 after an operation", async () => {
  using _c = stub(
    api.items,
    "create",
    () => Promise.resolve(item("new", "Cheese")),
  );
  const hook = useCatalogue([], []);
  await hook.addItem("Cheese");
  assertEquals(hook.pendingCount.value, 0);
});

Deno.test("refresh — re-pulls items and categories from the API", async () => {
  const hook = useCatalogue([item("i1", "Butter", "d")], [cat("d", "Dairy")]);

  const itemsStub = stub(
    api.items,
    "getAll",
    () => Promise.resolve([item("i2", "Milk", "d"), item("i3", "Bread", "b")]),
  );
  const catsStub = stub(
    api.categories,
    "getAll",
    () => Promise.resolve([cat("d", "Dairy"), cat("b", "Bakery")]),
  );
  try {
    await hook.refresh();
  } finally {
    itemsStub.restore();
    catsStub.restore();
  }

  assertEquals(hook.items.value.map((i) => i.name), ["Milk", "Bread"]);
  assertEquals(hook.categories.value.map((c) => c.label), ["Dairy", "Bakery"]);
});
