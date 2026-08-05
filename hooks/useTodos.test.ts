import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { api } from "@/services/api.ts";
import { useTodos } from "@/hooks/useTodos.ts";
import type { TodoInterface } from "@/models/index.ts";

function makeTodo(over: Partial<TodoInterface> = {}): TodoInterface {
  return {
    id: "t1",
    householdId: "hh",
    title: "Take out the bins",
    createdBy: "u1",
    createdAt: "2026-08-03T10:00:00.000Z",
    completedAt: null,
    dueAt: null,
    ...over,
  };
}

Deno.test("useTodos — splits the initial to-dos into open and done", () => {
  const hook = useTodos([
    makeTodo({ id: "t1" }),
    makeTodo({ id: "t2", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
  assertEquals(hook.doneTodos.value.map((t) => t.id), ["t2"]);
});

Deno.test("tickOff — moves the to-do into done with a completedAt", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.openTodos.value, []);
  assertEquals(hook.doneTodos.value.length, 1);
  assertEquals(hook.doneTodos.value[0].id, "t1");
  assertEquals(hook.doneTodos.value[0].completedAt !== null, true);
});

Deno.test("tickOff — the to-do is in exitingIds during the 300ms animation", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");

  assertEquals(hook.exitingIds.value.includes("t1"), true);

  await time.tickAsync(300);
  await promise;

  assertEquals(hook.exitingIds.value.includes("t1"), false);
});

Deno.test("tickOff — rolls back and reports failure when the server rejects", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(null),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");
  await time.tickAsync(300);
  const ok = await promise;

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
  assertEquals(hook.doneTodos.value, []);
});

Deno.test("tickOff — an edit landing during the exit animation is not dropped", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.tickOff("t1");
  hook.editTodo("t1", { title: "Edited during animation" }); // before the wait elapses
  await time.tickAsync(300);
  await promise;

  assertEquals(hook.doneTodos.value.length, 1);
  assertEquals(hook.doneTodos.value[0].title, "Edited during animation");
});

Deno.test("unTick — rolls back and reports failure when the server rejects", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(null),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  const ok = await hook.unTick("t1");

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value, []);
  assertEquals(hook.doneTodos.value.map((t) => t.id), ["t1"]);
});

Deno.test("unTick — moves the to-do back to open with a null completedAt", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  const ok = await hook.unTick("t1");

  assertEquals(ok, true);
  assertEquals(hook.doneTodos.value, []);
  assertEquals(hook.openTodos.value.length, 1);
  assertEquals(hook.openTodos.value[0].completedAt, null);
});

Deno.test("removeTodo — removes the to-do and cancels a pending edit", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  using _d = stub(api.todos, "delete", (_id: string) => Promise.resolve(true));
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "Changed my mind" }); // schedules a 500ms write
  const promise = hook.removeTodo("t1");
  await time.tickAsync(300); // exit animation
  const ok = await promise;
  await time.tickAsync(1000); // the cancelled write must never fire

  assertEquals(ok, true);
  assertEquals(patches, []);
  assertEquals(hook.openTodos.value, []);
});

Deno.test("removeTodo — restores the to-do when the delete fails", async () => {
  using _d = stub(api.todos, "delete", (_id: string) => Promise.resolve(false));
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  const promise = hook.removeTodo("t1");
  await time.tickAsync(300);
  const ok = await promise;

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value.map((t) => t.id), ["t1"]);
});

Deno.test("editTodo — echoes locally but never persists a blank title", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "   " });
  await time.tickAsync(600);

  assertEquals(patches, []); // nothing written
  assertEquals(hook.openTodos.value[0].title, "   "); // local echo only
});

Deno.test("editTodo — a blank-title edit doesn't discard the rest of the merged patch", async () => {
  // Regression for the old guard: `if (patch.title !== undefined &&
  // !patch.title.trim()) return;` aborted the whole flush, so a merged patch
  // of {notes, title: ""} silently dropped the notes write too. Against that
  // guard this test asserts `patches === []`; the fix must make it `[{notes:
  // "n"}]` instead — only the blank title key is dropped, not the patch.
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { notes: "n" });
  hook.editTodo("t1", { title: "   " }); // merged into the same pending patch
  await time.tickAsync(600);

  assertEquals(patches, [{ notes: "n" }]);
});

Deno.test("flushTodo — restores the last non-empty title when the sheet closes on a blank field", () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", title: "Take out the bins" }),
  ]);

  hook.editTodo("t1", { title: "" }); // select-all-delete
  assertEquals(hook.openTodos.value[0].title, ""); // local echo only, still blank

  hook.flushTodo("t1"); // sheet closes

  assertEquals(hook.openTodos.value[0].title, "Take out the bins");
});

Deno.test("editTodo — persists a non-blank title after the debounce", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  using time = new FakeTime();
  hook.editTodo("t1", { title: "Take out the recycling" });
  await time.tickAsync(600);

  assertEquals(patches, [{ title: "Take out the recycling" }]);
  assertEquals(hook.openTodos.value[0].title, "Take out the recycling");
});

Deno.test("setDueAt — sets the due moment optimistically", async () => {
  const patches: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    patches.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, true);
  assertEquals(patches, [{ dueAt: "2026-08-10T09:00:00.000Z" }]);
  assertEquals(hook.openTodos.value[0].dueAt, "2026-08-10T09:00:00.000Z");
});

Deno.test("setDueAt — clears the due moment with null", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", dueAt: "2026-08-10T09:00:00.000Z" }),
  ]);

  const ok = await hook.setDueAt("t1", null);

  assertEquals(ok, true);
  assertEquals(hook.openTodos.value[0].dueAt, null);
});

Deno.test("setDueAt — rolls back and reports failure when the server rejects", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(null),
  );
  const hook = useTodos([makeTodo({ id: "t1", dueAt: null })]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, false);
  assertEquals(hook.openTodos.value[0].dueAt, null);
});

Deno.test("setDueAt — works on a done to-do", async () => {
  using _u = stub(
    api.todos,
    "update",
    (_id: string, _patch: unknown) => Promise.resolve(makeTodo()),
  );
  const hook = useTodos([
    makeTodo({ id: "t1", completedAt: "2026-08-02T12:00:00.000Z" }),
  ]);

  const ok = await hook.setDueAt("t1", "2026-08-10T09:00:00.000Z");

  assertEquals(ok, true);
  assertEquals(hook.doneTodos.value[0].dueAt, "2026-08-10T09:00:00.000Z");
});

Deno.test("setDueAt — returns false for an unknown id without calling the api", async () => {
  const calls: unknown[] = [];
  using _u = stub(api.todos, "update", (_id: string, patch: unknown) => {
    calls.push(patch);
    return Promise.resolve(makeTodo());
  });
  const hook = useTodos([makeTodo({ id: "t1" })]);

  assertEquals(await hook.setDueAt("nope", null), false);
  assertEquals(calls, []);
});
