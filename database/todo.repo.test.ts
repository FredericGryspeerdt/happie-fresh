import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { TodoRepo } from "@/database/todo.repo.ts";
import { getKv } from "@/database/db.ts";
import { TodoNotificationRepo } from "@/database/todo-notification.repo.ts";
import type { CreateTodoDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use (inside a repo method), and no repo method is called until a test
// body runs — so setting it here at module load is early enough. Each test uses
// a distinct householdId because the process-wide KV singleton is shared.
Deno.env.set("KV_PATH", ":memory:");

// sanitizeResources is disabled because getKv() opens a module-level KV
// singleton lazily on first use and never closes it (by design — it's meant
// to live for the process's lifetime, same as in production). Deno's default
// resource sanitizer would otherwise flag that singleton as "leaked" from
// whichever test happens to open it first.

function draft(
  householdId: string,
  title: string,
  overrides: Partial<CreateTodoDto> = {},
): CreateTodoDto {
  return {
    householdId,
    title,
    createdBy: "user-1",
    createdAt: new Date().toISOString(),
    completedAt: null,
    dueAt: null,
    ...overrides,
  };
}

Deno.test({
  name: "create — mints an id and stores the to-do open",
  sanitizeResources: false,
  async fn() {
    const todo = await TodoRepo.create(draft("hh-create", "Take out the bins"));

    assertEquals(todo.title, "Take out the bins");
    assertEquals(todo.completedAt, null);
    assertEquals(typeof todo.id, "string");
    assertEquals(todo.id.length > 0, true);

    const found = await TodoRepo.getById("hh-create", todo.id);
    assertEquals(found?.id, todo.id);
  },
});

Deno.test({
  name: "getAll — open to-dos come first, newest first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-open";
    await TodoRepo.create(draft(hh, "oldest", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "newest", {
      createdAt: "2026-08-03T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "middle", {
      createdAt: "2026-08-02T10:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), ["newest", "middle", "oldest"]);
  },
});

Deno.test({
  name: "getAll — done to-dos sort after open ones, most recently done first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-done";
    await TodoRepo.create(draft(hh, "still open", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "done earlier", {
      createdAt: "2026-08-02T10:00:00.000Z",
      completedAt: "2026-08-02T12:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "done later", {
      createdAt: "2026-08-03T10:00:00.000Z",
      completedAt: "2026-08-03T12:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), [
      "still open",
      "done later",
      "done earlier",
    ]);
  },
});

Deno.test({
  name: "getAll — ties on identical createdAt break by id for a stable order",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-tie";
    const sameInstant = "2026-08-03T10:00:00.000Z";
    const t1 = await TodoRepo.create(
      draft(hh, "captured first", { createdAt: sameInstant }),
    );
    const t2 = await TodoRepo.create(
      draft(hh, "captured second", { createdAt: sameInstant }),
    );

    const expectedIds = [t1.id, t2.id].sort((a, b) => a.localeCompare(b));

    // Fetching repeatedly must always agree on the same order (not KV
    // iteration order, which could otherwise vary run to run).
    const first = await TodoRepo.getAll(hh);
    const second = await TodoRepo.getAll(hh);
    assertEquals(first.map((t) => t.id), expectedIds);
    assertEquals(second.map((t) => t.id), expectedIds);
  },
});

Deno.test({
  name: "getById — returns null for an unknown id",
  sanitizeResources: false,
  async fn() {
    assertEquals(await TodoRepo.getById("hh-missing", "nope"), null);
  },
});

Deno.test({
  name: "update — a partial patch does not clobber omitted fields",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-update";
    const todo = await TodoRepo.create(
      draft(hh, "Call the dentist", { notes: "09 123 45 67" }),
    );

    const updated = await TodoRepo.update(hh, todo.id, {
      completedAt: "2026-08-03T09:00:00.000Z",
    });

    assertEquals(updated?.completedAt, "2026-08-03T09:00:00.000Z");
    assertEquals(updated?.title, "Call the dentist");
    assertEquals(updated?.notes, "09 123 45 67");
    assertEquals(updated?.createdBy, "user-1");
  },
});

Deno.test({
  name: "update — un-ticking writes completedAt back to null",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-untick";
    const todo = await TodoRepo.create(
      draft(hh, "Pay the water bill", {
        completedAt: "2026-08-03T09:00:00.000Z",
      }),
    );

    const updated = await TodoRepo.update(hh, todo.id, { completedAt: null });

    assertEquals(updated?.completedAt, null);
  },
});

Deno.test({
  name: "update — returns null for an unknown id",
  sanitizeResources: false,
  async fn() {
    assertEquals(
      await TodoRepo.update("hh-update-missing", "nope", { title: "x" }),
      null,
    );
  },
});

Deno.test({
  name: "delete — removes the to-do",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-delete";
    const todo = await TodoRepo.create(draft(hh, "Cancel the newspaper"));

    await TodoRepo.delete(hh, todo.id);

    assertEquals(await TodoRepo.getById(hh, todo.id), null);
    assertEquals(await TodoRepo.getAll(hh), []);
  },
});

Deno.test({
  name: "households are isolated — one never reads another's to-dos",
  sanitizeResources: false,
  async fn() {
    const mine = await TodoRepo.create(draft("hh-mine", "Mine"));
    await TodoRepo.create(draft("hh-theirs", "Theirs"));

    assertEquals((await TodoRepo.getAll("hh-mine")).map((t) => t.title), [
      "Mine",
    ]);
    assertEquals(await TodoRepo.getById("hh-theirs", mine.id), null);
    assertEquals(
      await TodoRepo.update("hh-theirs", mine.id, { title: "x" }),
      null,
    );
  },
});

Deno.test({
  name: "getAll — dated open to-dos come before undated ones, soonest first",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due";
    await TodoRepo.create(draft(hh, "undated newer", {
      createdAt: "2026-08-03T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "undated older", {
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "due later", {
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: "2026-09-01T09:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "due soon", {
      createdAt: "2026-08-01T10:00:00.000Z",
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), [
      "due soon",
      "due later",
      "undated newer",
      "undated older",
    ]);
  },
});

Deno.test({
  name: "getAll — ties on identical dueAt break by id for a stable order",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due-tie";
    const a = await TodoRepo.create(draft(hh, "a", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));
    const b = await TodoRepo.create(draft(hh, "b", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const all = await TodoRepo.getAll(hh);
    const expected = [a.id, b.id].sort((x, y) => x.localeCompare(y));

    assertEquals(all.map((t) => t.id), expected);
  },
});

Deno.test({
  name: "getAll — done to-dos stay after every open one, dated or not",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-order-due-done";
    await TodoRepo.create(draft(hh, "done", {
      completedAt: "2026-08-04T12:00:00.000Z",
      dueAt: "2026-08-01T09:00:00.000Z",
    }));
    await TodoRepo.create(draft(hh, "open undated"));

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.map((t) => t.title), ["open undated", "done"]);
  },
});

Deno.test({
  name: "getAll — a record stored without dueAt reads back as null",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-legacy";
    const kv = await getKv();
    const id = "legacy-1";
    // Write a pre-dueAt record shape directly, bypassing create().
    await kv.set(["todos", hh, id], {
      id,
      householdId: hh,
      title: "written before dueAt existed",
      createdBy: "user-1",
      createdAt: "2026-07-01T10:00:00.000Z",
      completedAt: null,
    });

    const all = await TodoRepo.getAll(hh);

    assertEquals(all.length, 1);
    assertEquals(all[0].dueAt, null);
    assertEquals((await TodoRepo.getById(hh, id))?.dueAt, null);
  },
});

Deno.test({
  name: "update — clearing dueAt to null sticks",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-clear-due";
    const todo = await TodoRepo.create(draft(hh, "Book the venue", {
      dueAt: "2026-08-10T09:00:00.000Z",
    }));

    const updated = await TodoRepo.update(hh, todo.id, { dueAt: null });

    assertEquals(updated?.dueAt, null);
    assertEquals(updated?.title, "Book the venue");
  },
});

Deno.test({
  name: "delete — also removes the to-do's notification markers",
  sanitizeResources: false,
  async fn() {
    const hh = "hh-todo-cascade";
    const todo = await TodoRepo.create(draft(hh, "Book the venue"));
    await TodoNotificationRepo.claim(
      hh,
      todo.id,
      "due@2026-08-06T07:00:00.000Z",
      { sent: true },
    );

    await TodoRepo.delete(hh, todo.id);

    // Claimable again only because the marker is gone.
    assertEquals(
      await TodoNotificationRepo.claim(
        hh,
        todo.id,
        "due@2026-08-06T07:00:00.000Z",
        { sent: true },
      ),
      true,
    );
  },
});
