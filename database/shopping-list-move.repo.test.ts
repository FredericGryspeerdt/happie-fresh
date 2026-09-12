import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { ShoppingListMoveRepo } from "./shopping-list-move.repo.ts";
import { ShoppingListRepo } from "./shopping-list.repo.ts";
import { ShoppingListItemRepo } from "./shopping-list-item.repo.ts";
Deno.env.set("KV_PATH", ":memory:");
async function setup() {
  const householdId = crypto.randomUUID();
  const source = await ShoppingListRepo.create({
    householdId,
    name: "Weekly",
    createdBy: "member",
    createdAt: "2026-09-12",
  });
  const destination = await ShoppingListRepo.create({
    householdId,
    name: "Quick trip",
    createdBy: "member",
    createdAt: "2026-09-12",
  });
  const a = await ShoppingListItemRepo.add(source.id, "milk");
  const b = await ShoppingListItemRepo.add(source.id, "bread");
  await ShoppingListItemRepo.update(source.id, a.id, {
    quantity: 3,
    unit: "L",
    note: "big pack",
    checked: true,
  });
  return { householdId, source, destination, a, b };
}
Deno.test({
  name:
    "move preserves separate entries and metadata; replay and undo are idempotent",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, destination, a, b } = await setup();
    const existing = await ShoppingListItemRepo.add(destination.id, "milk");
    const input = {
      requestId: crypto.randomUUID(),
      itemIds: [a.id, b.id],
      destinationListId: destination.id,
    };
    const moved = await ShoppingListMoveRepo.move(
      householdId,
      "member",
      source.id,
      input,
    );
    assert(moved.ok);
    assertEquals(await ShoppingListItemRepo.getAll(source.id), []);
    const entries = await ShoppingListItemRepo.getAll(destination.id);
    assertEquals(entries.length, 3);
    assertEquals(entries.find((e) => e.id === a.id), {
      ...a,
      listId: destination.id,
      quantity: 3,
      unit: "L",
      note: "big pack",
      checked: true,
    });
    assertEquals(
      await ShoppingListMoveRepo.move(householdId, "member", source.id, input),
      moved,
    );
    const undone = await ShoppingListMoveRepo.undo(
      householdId,
      source.id,
      input.requestId,
    );
    assert(undone.ok);
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 2);
    assertEquals(
      (await ShoppingListItemRepo.getAll(destination.id)).map((e) => e.id),
      [existing.id],
    );
    assertEquals(
      await ShoppingListMoveRepo.undo(householdId, source.id, input.requestId),
      undone,
    );
  },
});
Deno.test({
  name: "new list and move commit together; undo keeps new list",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, a } = await setup();
    const input = {
      requestId: crypto.randomUUID(),
      itemIds: [a.id],
      newListName: "  Quick trip  ",
    };
    const moved = await ShoppingListMoveRepo.move(
      householdId,
      "member",
      source.id,
      input,
    );
    assert(moved.ok);
    assertEquals(moved.destination.name, "Quick trip");
    assertEquals(moved.destination.createdBy, "member");
    assert(
      (await ShoppingListMoveRepo.undo(householdId, source.id, input.requestId))
        .ok,
    );
    assert(await ShoppingListRepo.getById(householdId, moved.destination.id));
    assertEquals(await ShoppingListItemRepo.getAll(moved.destination.id), []);
  },
});
Deno.test({
  name: "missing entry aborts whole move including new list creation",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, a } = await setup();
    const result = await ShoppingListMoveRepo.move(
      householdId,
      "member",
      source.id,
      {
        requestId: crypto.randomUUID(),
        itemIds: [a.id, "missing"],
        newListName: "New",
      },
    );
    assert(!result.ok);
    assertEquals((await ShoppingListRepo.getAll(householdId)).length, 2);
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 2);
  },
});
Deno.test({
  name: "undo refuses changed entries without undoing any other entries",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, destination, a, b } = await setup();
    const requestId = crypto.randomUUID();
    assert(
      (await ShoppingListMoveRepo.move(householdId, "member", source.id, {
        requestId,
        itemIds: [a.id, b.id],
        destinationListId: destination.id,
      })).ok,
    );
    await ShoppingListItemRepo.update(destination.id, a.id, { quantity: 9 });
    assert(
      !(await ShoppingListMoveRepo.undo(householdId, source.id, requestId)).ok,
    );
    assertEquals(await ShoppingListItemRepo.getAll(source.id), []);
    assertEquals(
      (await ShoppingListItemRepo.getAll(destination.id)).find((e) =>
        e.id === a.id
      )?.quantity,
      9,
    );
    assertEquals(
      await ShoppingListItemRepo.update(source.id, a.id, { quantity: 99 }),
      null,
    );
  },
});
Deno.test({
  name:
    "move rejects cross-household lists, invalid selections and same destination",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, destination, a } = await setup();
    const foreign = await setup();
    for (
      const itemIds of [
        [],
        [a.id, a.id],
        Array.from({ length: 41 }, (_, i) => `id-${i}`),
      ]
    ) {
      assert(
        !(await ShoppingListMoveRepo.move(householdId, "member", source.id, {
          requestId: crypto.randomUUID(),
          itemIds,
          destinationListId: destination.id,
        })).ok,
      );
    }
    for (const destinationListId of [source.id, foreign.destination.id]) {
      assert(
        !(await ShoppingListMoveRepo.move(householdId, "member", source.id, {
          requestId: crypto.randomUUID(),
          itemIds: [a.id],
          destinationListId,
        })).ok,
      );
    }
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 2);
  },
});

Deno.test({
  name:
    "a PATCH already reading during a move cannot resurrect the source entry",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, destination, a } = await setup();
    const { getKv } = await import("./db.ts");
    const kv = await getKv();
    const original = kv.get.bind(kv);
    let release!: () => void;
    let read!: () => void;
    const gate = new Promise<void>((resolve) => release = resolve);
    const ready = new Promise<void>((resolve) => read = resolve);
    kv.get = async <T>(
      key: Deno.KvKey,
      options?: { consistency?: Deno.KvConsistencyLevel },
    ) => {
      const entry = await original<T>(key, options);
      read();
      await gate;
      return entry;
    };
    const updating = ShoppingListItemRepo.update(source.id, a.id, {
      quantity: 99,
    });
    await ready;
    kv.get = original;
    try {
      assert(
        (await ShoppingListMoveRepo.move(householdId, "member", source.id, {
          requestId: crypto.randomUUID(),
          itemIds: [a.id],
          destinationListId: destination.id,
        })).ok,
      );
    } finally {
      release();
    }
    assertEquals(await updating, null);
    assertEquals(
      (await ShoppingListItemRepo.getAll(source.id)).some((e) => e.id === a.id),
      false,
    );
  },
});

Deno.test({
  name: "maximum selection moves atomically and can be undone",
  sanitizeResources: false,
  async fn() {
    const { householdId, source, destination, a, b } = await setup();
    const entries = [];
    for (let i = 0; i < 38; i++) {
      entries.push(await ShoppingListItemRepo.add(source.id, `item-${i}`));
    }
    const input = {
      requestId: crypto.randomUUID(),
      itemIds: [a.id, b.id, ...entries.map((e) => e.id)],
      destinationListId: destination.id,
    };
    assert(
      (await ShoppingListMoveRepo.move(householdId, "member", source.id, input))
        .ok,
    );
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 0);
    assert(
      (await ShoppingListMoveRepo.undo(householdId, source.id, input.requestId))
        .ok,
    );
    assertEquals((await ShoppingListItemRepo.getAll(source.id)).length, 40);
  },
});

Deno.test({
  name: "menu additions retry their snapshot after a move or undo",
  sanitizeResources: false,
  async fn() {
    const { getKv } = await import("./db.ts");
    const kv = await getKv();
    for (const undo of [false, true]) {
      const { householdId, source, destination, a } = await setup();
      const requestId = crypto.randomUUID();
      const move = () =>
        ShoppingListMoveRepo.move(householdId, "member", source.id, {
          requestId,
          itemIds: [a.id],
          destinationListId: destination.id,
        });
      if (undo) assert((await move()).ok);
      const from = undo ? destination.id : source.id;
      const original = kv.list.bind(kv);
      let release!: () => void;
      let read!: () => void;
      const gate = new Promise<void>((r) => release = r);
      const ready = new Promise<void>((r) => read = r);
      // Pause after bulkAdd has read all entries, before it commits its snapshot.
      kv.list = <T>(
        selector: Deno.KvListSelector,
        options?: Deno.KvListOptions,
      ) => {
        const iterator = original<T>(selector, options);
        const next = iterator.next.bind(iterator);
        iterator.next = async () => {
          const result = await next();
          if (result.done) {
            read();
            await gate;
          }
          return result;
        };
        return iterator;
      };
      const adding = ShoppingListItemRepo.bulkAdd(from, [{
        itemId: "milk",
        quantity: 1,
        unit: "L",
      }]);
      await ready;
      kv.list = original;
      try {
        assert(
          (await (undo
            ? ShoppingListMoveRepo.undo(householdId, source.id, requestId)
            : move())).ok,
        );
      } finally {
        release();
      }
      const added = await adding;
      assertEquals(added.added.length, 1);
      assert(added.added[0].id !== a.id);
      assertEquals(
        (await ShoppingListItemRepo.getAll(from)).some((entry) =>
          entry.id === a.id
        ),
        false,
      );
    }
  },
});
