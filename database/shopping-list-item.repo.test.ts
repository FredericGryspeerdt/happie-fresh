import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { getKv } from "@/database/db.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use (inside a repo method), and no repo method is called until a test
// body runs — so setting it here at module load is early enough. Each test uses
// a distinct listId because the process-wide KV singleton is shared.
Deno.env.set("KV_PATH", ":memory:");

// sanitizeResources is disabled because getKv() opens a module-level KV
// singleton lazily on first use and never closes it (by design — it's meant
// to live for the process's lifetime, same as in production). Deno's default
// resource sanitizer would otherwise flag that singleton as "leaked" from
// whichever test happens to open it first.

Deno.test({
  name: "clearChecked — removes only checked items and returns their count",
  sanitizeResources: false,
  async fn() {
    const listId = "list-clear-1";
    const a = await ShoppingListItemRepo.add(listId, "item-a");
    const b = await ShoppingListItemRepo.add(listId, "item-b");
    const c = await ShoppingListItemRepo.add(listId, "item-c");
    await ShoppingListItemRepo.update(listId, a.id, { checked: true });
    await ShoppingListItemRepo.update(listId, c.id, { checked: true });

    const cleared = await ShoppingListItemRepo.clearChecked(listId);

    assertEquals(cleared, 2);
    const remaining = await ShoppingListItemRepo.getAll(listId);
    assertEquals(remaining.map((i) => i.id), [b.id]);
  },
});

Deno.test({
  name: "clearChecked — returns 0 and deletes nothing when no item is checked",
  sanitizeResources: false,
  async fn() {
    const listId = "list-clear-2";
    await ShoppingListItemRepo.add(listId, "item-a");
    await ShoppingListItemRepo.add(listId, "item-b");

    const cleared = await ShoppingListItemRepo.clearChecked(listId);

    assertEquals(cleared, 0);
    const remaining = await ShoppingListItemRepo.getAll(listId);
    assertEquals(remaining.length, 2);
  },
});

async function clearListItems(listId: string) {
  const kv = await getKv();
  for await (
    const e of kv.list({ prefix: ["shopping_list_items", listId] })
  ) {
    await kv.delete(e.key);
  }
}

Deno.test({
  name: "bulkAdd — creates unchecked entries with quantity 1 and the note",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L1");
    const res = await ShoppingListItemRepo.bulkAdd("L1", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "rice" },
    ]);
    assertEquals(res.added.length, 2);
    assertEquals(res.restored, []);
    assertEquals(res.skipped, []);
    const all = await ShoppingListItemRepo.getAll("L1");
    const pasta = all.find((li) => li.itemId === "pasta")!;
    assertEquals(pasta.quantity, 1);
    assertEquals(pasta.checked, false);
    assertEquals(pasta.note, "Lasagne");
    assertEquals(all.find((li) => li.itemId === "rice")!.note, undefined);
  },
});

Deno.test({
  name:
    "bulkAdd — an unchecked existing entry is skipped; empty note is filled, written note is kept",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L2");
    const a = await ShoppingListItemRepo.add("L2", "pasta");
    const b = await ShoppingListItemRepo.add("L2", "milk");
    await ShoppingListItemRepo.update("L2", b.id, { note: "the blue one" });
    const res = await ShoppingListItemRepo.bulkAdd("L2", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "milk", note: "Pancakes" },
    ]);
    assertEquals(res.added, []);
    assertEquals(res.restored, []);
    assertEquals(new Set(res.skipped), new Set(["pasta", "milk"]));
    const all = await ShoppingListItemRepo.getAll("L2");
    assertEquals(all.length, 2);
    assertEquals(all.find((li) => li.id === a.id)!.note, "Lasagne");
    assertEquals(all.find((li) => li.id === b.id)!.note, "the blue one");
  },
});

Deno.test({
  name:
    "bulkAdd — a checked existing entry is restored (unchecked), not duplicated",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L3");
    const a = await ShoppingListItemRepo.add("L3", "pasta");
    await ShoppingListItemRepo.update("L3", a.id, { checked: true });
    const res = await ShoppingListItemRepo.bulkAdd("L3", [
      { itemId: "pasta", note: "Lasagne" },
    ]);
    assertEquals(res.added, []);
    assertEquals(res.restored.map((li) => li.id), [a.id]);
    assertEquals(res.restored[0].checked, false);
    assertEquals(res.restored[0].note, "Lasagne");
    const all = await ShoppingListItemRepo.getAll("L3");
    assertEquals(all.length, 1);
    assertEquals(all[0].checked, false);
  },
});

Deno.test({
  name: "bulkAdd — repeated item ids in the input are collapsed to one entry",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L4");
    const res = await ShoppingListItemRepo.bulkAdd("L4", [
      { itemId: "pasta", note: "Lasagne" },
      { itemId: "pasta", note: "Carbonara" },
    ]);
    assertEquals(res.added.length, 1);
    assertEquals((await ShoppingListItemRepo.getAll("L4")).length, 1);
  },
});

Deno.test({
  name:
    "bulkAdd — when the list holds both a checked and an unchecked entry for an item, the unchecked one wins (skipped)",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L5");
    const bought = await ShoppingListItemRepo.add("L5", "pasta");
    await ShoppingListItemRepo.update("L5", bought.id, { checked: true });
    await ShoppingListItemRepo.add("L5", "pasta");
    const res = await ShoppingListItemRepo.bulkAdd("L5", [{ itemId: "pasta" }]);
    assertEquals(res.skipped, ["pasta"]);
    assertEquals(res.restored, []);
    assertEquals(
      (await ShoppingListItemRepo.getAll("L5")).find((li) =>
        li.id === bought.id
      )!.checked,
      true,
    );
  },
});

Deno.test({
  name: "bulkAdd — empty input writes nothing",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L6");
    const res = await ShoppingListItemRepo.bulkAdd("L6", []);
    assertEquals(res, { added: [], restored: [], skipped: [] });
    assertEquals(await ShoppingListItemRepo.getAll("L6"), []);
  },
});
