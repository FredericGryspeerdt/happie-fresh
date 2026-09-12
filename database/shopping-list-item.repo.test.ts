import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.19";
import {
  ShoppingAmountConflict,
  ShoppingListItemRepo,
} from "@/database/shopping-list-item.repo.ts";
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
  await kv.delete(["shopping_list_items_rev", listId]);
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

Deno.test({
  name:
    "bulkAdd — two concurrent bulk adds of the same new item create exactly one entry",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L7");
    await Promise.all([
      ShoppingListItemRepo.bulkAdd("L7", [{ itemId: "pasta", note: "A" }]),
      ShoppingListItemRepo.bulkAdd("L7", [{ itemId: "pasta", note: "B" }]),
    ]);
    const all = await ShoppingListItemRepo.getAll("L7");
    assertEquals(all.length, 1);
    assertEquals(all[0].itemId, "pasta");
    assertEquals(all[0].checked, false);
  },
});

Deno.test({
  name: "deleteAll — also removes the list's revision key",
  sanitizeResources: false,
  async fn() {
    const listId = "list-delete-all-1";
    await clearListItems(listId);
    await ShoppingListItemRepo.bulkAdd(listId, [{ itemId: "pasta" }]);
    const kv = await getKv();
    const before = await kv.get(["shopping_list_items_rev", listId]);
    assertEquals(before.value !== null, true);

    await ShoppingListItemRepo.deleteAll(listId);

    const after = await kv.get(["shopping_list_items_rev", listId]);
    assertEquals(after.value, null);
    assertEquals(await ShoppingListItemRepo.getAll(listId), []);
  },
});

Deno.test({
  name: "bulkAdd — a whitespace-only note is treated as no note",
  sanitizeResources: false,
  async fn() {
    await clearListItems("L8");
    const res = await ShoppingListItemRepo.bulkAdd("L8", [
      { itemId: "pasta", note: "   " },
    ]);
    assertEquals(res.added[0].note, undefined);
    assertEquals((await ShoppingListItemRepo.getAll("L8"))[0].note, undefined);
  },
});

Deno.test({
  name: "bulkAdd — stores requested fractional amounts and units",
  sanitizeResources: false,
  async fn() {
    const result = await ShoppingListItemRepo.bulkAdd("amount-new", [
      { itemId: "meat", quantity: 0.5, unit: "kg" },
    ]);
    assertEquals(result.added[0].quantity, 0.5);
    assertEquals(result.added[0].unit, "kg");
    assertEquals(await ShoppingListItemRepo.getAll("amount-new"), result.added);
  },
});

Deno.test({
  name:
    "bulkAdd — replaces bought amounts, preserves written notes and pending amounts",
  sanitizeResources: false,
  async fn() {
    const bought = await ShoppingListItemRepo.add("amount-restore", "meat");
    const pending = await ShoppingListItemRepo.add("amount-restore", "milk");
    await ShoppingListItemRepo.update("amount-restore", bought.id, {
      checked: true,
      quantity: 2,
      unit: "kg",
      note: "Lean",
    });
    await ShoppingListItemRepo.update("amount-restore", pending.id, {
      quantity: 3,
      unit: "L",
    });
    const result = await ShoppingListItemRepo.bulkAdd("amount-restore", [
      { itemId: "meat", quantity: 500, unit: "g", note: "Lasagne" },
      { itemId: "milk", quantity: 0.5, unit: "L" },
    ]);
    assertEquals(result.restored[0].quantity, 500);
    assertEquals(result.restored[0].unit, "g");
    assertEquals(result.restored[0].note, "Lean");
    const all = await ShoppingListItemRepo.getAll("amount-restore");
    assertEquals(all.find((i) => i.id === pending.id)?.quantity, 3);
  },
});

Deno.test({
  name: "update — concurrent amount and note edits preserve both changes",
  sanitizeResources: false,
  async fn() {
    const entry = await ShoppingListItemRepo.add("amount-concurrent", "meat");
    await Promise.all([
      ShoppingListItemRepo.update("amount-concurrent", entry.id, {
        quantity: 0.5,
        unit: "kg",
      }),
      ShoppingListItemRepo.update("amount-concurrent", entry.id, {
        note: "Lean",
      }),
    ]);
    const saved = (await ShoppingListItemRepo.getAll("amount-concurrent"))[0];
    assertEquals(saved.quantity, 0.5);
    assertEquals(saved.unit, "kg");
    assertEquals(saved.note, "Lean");
  },
});

Deno.test({
  name: "bulkAdd — restoring while a note is edited preserves the edit",
  sanitizeResources: false,
  async fn() {
    const entry = await ShoppingListItemRepo.add("restore-concurrent", "meat");
    await ShoppingListItemRepo.update("restore-concurrent", entry.id, {
      checked: true,
    });
    await Promise.all([
      ShoppingListItemRepo.bulkAdd("restore-concurrent", [{
        itemId: "meat",
        quantity: 0.5,
        unit: "kg",
        note: "Lasagne",
      }]),
      ShoppingListItemRepo.update("restore-concurrent", entry.id, {
        note: "Lean",
      }),
    ]);
    const saved = (await ShoppingListItemRepo.getAll("restore-concurrent"))[0];
    assertEquals(saved.checked, false);
    assertEquals(saved.quantity, 0.5);
    assertEquals(saved.unit, "kg");
    assertEquals(saved.note, "Lean");
  },
});

Deno.test({
  name:
    "bulkAdd — additional amounts accumulate once per request across concurrent retries",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-retries";
    const carrot = await ShoppingListItemRepo.add(listId, "carrot");
    const inputs = [{ itemId: "carrot", quantity: 3 }];
    const options = { requestId: "same-request", addToExisting: true as const };
    const [a, b] = await Promise.all([
      ShoppingListItemRepo.bulkAdd(listId, inputs, options),
      ShoppingListItemRepo.bulkAdd(listId, inputs, options),
    ]);
    assertEquals(a, b);
    assertEquals(a.updated?.[0].quantity, 4);
    await ShoppingListItemRepo.bulkAdd(listId, inputs, {
      ...options,
      requestId: "next-request",
    });
    assertEquals(
      (await ShoppingListItemRepo.getAll(listId)).find((i) =>
        i.id === carrot.id
      )?.quantity,
      7,
    );
    assertEquals(
      await ShoppingListItemRepo.bulkAdd(listId, inputs, options),
      a,
    );
  },
});

Deno.test({
  name:
    "bulkAdd — incompatible or overflowing totals reject the whole request; corrected requests can retry",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-invalid";
    const entry = await ShoppingListItemRepo.add(listId, "carrot");
    const options = { requestId: "correction", addToExisting: true as const };
    await assertRejects(
      () =>
        ShoppingListItemRepo.bulkAdd(listId, [{ itemId: "rice" }, {
          itemId: "carrot",
          quantity: 1,
          unit: "kg",
        }], options),
      ShoppingAmountConflict,
    );
    assertEquals(await ShoppingListItemRepo.getAll(listId), [entry]);
    await assertRejects(() =>
      ShoppingListItemRepo.bulkAdd(listId, [{
        itemId: "carrot",
        quantity: 99999,
      }], options), ShoppingAmountConflict);
    await ShoppingListItemRepo.bulkAdd(listId, [{
      itemId: "carrot",
      quantity: 3,
    }], options);
    await assertRejects(() =>
      ShoppingListItemRepo.bulkAdd(
        listId,
        [{ itemId: "carrot", quantity: 2 }],
        options,
      ), ShoppingAmountConflict);
    assertEquals((await ShoppingListItemRepo.getAll(listId))[0].quantity, 4);
  },
});
Deno.test({
  name:
    "bulkAdd — concurrent distinct requests combine converted amounts and restore bought amounts",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-units";
    const meat = await ShoppingListItemRepo.add(listId, "meat");
    const rice = await ShoppingListItemRepo.add(listId, "rice");
    await ShoppingListItemRepo.update(listId, meat.id, {
      quantity: 1,
      unit: "kg",
      note: "Lean",
    });
    await ShoppingListItemRepo.update(listId, rice.id, {
      quantity: 9,
      unit: "kg",
      checked: true,
    });
    await Promise.all(
      ["a", "b"].map((requestId) =>
        ShoppingListItemRepo.bulkAdd(listId, [{
          itemId: "meat",
          quantity: 250,
          unit: "g",
        }], { requestId, addToExisting: true })
      ),
    );
    const restored = await ShoppingListItemRepo.bulkAdd(listId, [{
      itemId: "rice",
    }], { requestId: "restore", addToExisting: true });
    const all = await ShoppingListItemRepo.getAll(listId);
    assertEquals(
      all.find((i) => i.id === meat.id)?.quantity,
      1.5,
    );
    assertEquals(all.find((i) => i.id === meat.id)?.unit, "kg");
    assertEquals(all.find((i) => i.id === meat.id)?.note, "Lean");
    assertEquals(restored.restored[0].quantity, 1);
    assertEquals(restored.restored[0].unit, "pieces");
  },
});

Deno.test({
  name: "bulkAdd — 500 existing items update atomically within KV check limits",
  sanitizeResources: false,
  async fn() {
    const listId = "large-additive";
    const inputs = Array.from(
      { length: 500 },
      (_, i) => ({ itemId: `item-${i}`, note: "A dish" }),
    );
    await ShoppingListItemRepo.bulkAdd(listId, inputs);
    const result = await ShoppingListItemRepo.bulkAdd(listId, inputs, {
      requestId: "large",
      addToExisting: true,
    });
    assertEquals(result.updated?.length, 500);
    assertEquals(
      (await ShoppingListItemRepo.getAll(listId)).every((i) =>
        i.quantity === 2
      ),
      true,
    );
    assertEquals(
      await ShoppingListItemRepo.bulkAdd(listId, inputs, {
        requestId: "large",
        addToExisting: true,
      }),
      result,
    );
  },
});

Deno.test({
  name:
    "bulkAdd — concurrent ordinary writes preserve notes and unrelated entries",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-ordinary";
    const carrot = await ShoppingListItemRepo.add(listId, "carrot");
    await Promise.all([
      ShoppingListItemRepo.bulkAdd(
        listId,
        [{ itemId: "carrot", quantity: 3 }],
        { requestId: "ordinary", addToExisting: true },
      ),
      ShoppingListItemRepo.update(listId, carrot.id, { note: "Organic" }),
      ShoppingListItemRepo.add(listId, "rice"),
    ]);
    const all = await ShoppingListItemRepo.getAll(listId);
    assertEquals(all.find((i) => i.id === carrot.id)?.quantity, 4);
    assertEquals(all.find((i) => i.id === carrot.id)?.note, "Organic");
    assertEquals(all.some((i) => i.itemId === "rice"), true);
  },
});
Deno.test({
  name:
    "bulkAdd — concurrent removal never resurrects the stale existing amount",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-delete";
    const carrot = await ShoppingListItemRepo.add(listId, "carrot");
    await ShoppingListItemRepo.update(listId, carrot.id, { quantity: 20 });
    await Promise.all([
      ShoppingListItemRepo.bulkAdd(
        listId,
        [{ itemId: "carrot", quantity: 3 }],
        { requestId: "remove", addToExisting: true },
      ),
      ShoppingListItemRepo.delete(listId, carrot.id),
    ]);
    const all = await ShoppingListItemRepo.getAll(listId);
    // Delete after add leaves nothing; add after delete creates only the new 3.
    assertEquals(
      all.every((i) => i.quantity === 3 && i.id !== carrot.id),
      true,
    );
  },
});
Deno.test({
  name:
    "bulkAdd — concurrent clear-bought retains the newly requested quantity",
  sanitizeResources: false,
  async fn() {
    const listId = "additive-clear";
    const carrot = await ShoppingListItemRepo.add(listId, "carrot");
    await ShoppingListItemRepo.update(listId, carrot.id, {
      checked: true,
      quantity: 20,
    });
    await Promise.all([
      ShoppingListItemRepo.bulkAdd(
        listId,
        [{ itemId: "carrot", quantity: 3 }],
        { requestId: "clear", addToExisting: true },
      ),
      ShoppingListItemRepo.clearChecked(listId),
    ]);
    const all = await ShoppingListItemRepo.getAll(listId);
    assertEquals(all.length, 1);
    assertEquals(all[0].quantity, 3);
    assertEquals(all[0].checked, false);
  },
});
Deno.test({
  name: "deleteAll — removes request receipts only for the deleted list",
  sanitizeResources: false,
  async fn() {
    const options = { requestId: "cleanup", addToExisting: true as const };
    await ShoppingListItemRepo.bulkAdd("receipt-deleted", [{
      itemId: "carrot",
    }], options);
    const kept = await ShoppingListItemRepo.bulkAdd("receipt-kept", [{
      itemId: "carrot",
    }], options);
    await ShoppingListItemRepo.deleteAll("receipt-deleted");
    const kv = await getKv();
    let count = 0;
    for await (
      const _ of kv.list({
        prefix: ["shopping_bulk_receipts", "receipt-deleted"],
      })
    ) {
      count++;
    }
    assertEquals(count, 0);
    assertEquals(
      await ShoppingListItemRepo.bulkAdd(
        "receipt-kept",
        [{ itemId: "carrot" }],
        options,
      ),
      kept,
    );
  },
});
