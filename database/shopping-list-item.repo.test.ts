import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";

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
