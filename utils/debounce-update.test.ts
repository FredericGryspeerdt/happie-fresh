import { assertEquals } from "$std/assert/mod.ts";
import { createDebouncedMergeScheduler } from "@/utils/debounce-update.ts";

type Patch = { x?: number; y?: number };
type Flushed = { id: string; patch: Partial<Patch> };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("flush(id) fires once with the merged patch and cancels the pending timer", async () => {
  const flushed: Flushed[] = [];
  const scheduler = createDebouncedMergeScheduler<Patch>({
    delayMs: 40,
    flush: (id, patch) => {
      flushed.push({ id, patch });
    },
  });

  scheduler.schedule("a", { x: 1 });
  scheduler.schedule("a", { y: 2 });
  scheduler.flush("a");

  // Fires synchronously, exactly once, with both patches merged.
  assertEquals(flushed, [{ id: "a", patch: { x: 1, y: 2 } }]);

  // The debounced timer must not also fire once the delay elapses.
  await wait(90);
  assertEquals(flushed.length, 1);
});

Deno.test("flush(id) is a no-op when nothing is pending", () => {
  const flushed: Flushed[] = [];
  const scheduler = createDebouncedMergeScheduler<Patch>({
    delayMs: 40,
    flush: (id, patch) => {
      flushed.push({ id, patch });
    },
  });

  scheduler.flush("missing");
  assertEquals(flushed.length, 0);
});

Deno.test("flushAll() flushes every pending id exactly once", async () => {
  const flushed: Flushed[] = [];
  const scheduler = createDebouncedMergeScheduler<Patch>({
    delayMs: 40,
    flush: (id, patch) => {
      flushed.push({ id, patch });
    },
  });

  scheduler.schedule("a", { x: 1 });
  scheduler.schedule("b", { y: 2 });
  scheduler.flushAll();

  assertEquals(flushed.length, 2);
  assertEquals(flushed.find((f) => f.id === "a")?.patch, { x: 1 });
  assertEquals(flushed.find((f) => f.id === "b")?.patch, { y: 2 });

  // No pending timers remain to fire a second time.
  await wait(90);
  assertEquals(flushed.length, 2);
});

Deno.test("schedule merges patches and flushes once after the delay", async () => {
  const flushed: Flushed[] = [];
  const scheduler = createDebouncedMergeScheduler<Patch>({
    delayMs: 20,
    flush: (id, patch) => {
      flushed.push({ id, patch });
    },
  });

  scheduler.schedule("a", { x: 1 });
  scheduler.schedule("a", { x: 5, y: 2 }); // later value wins on key conflict

  await wait(80);
  assertEquals(flushed, [{ id: "a", patch: { x: 5, y: 2 } }]);
});

Deno.test("cancel(id) prevents a pending flush", async () => {
  const flushed: Flushed[] = [];
  const scheduler = createDebouncedMergeScheduler<Patch>({
    delayMs: 20,
    flush: (id, patch) => {
      flushed.push({ id, patch });
    },
  });

  scheduler.schedule("a", { x: 1 });
  scheduler.cancel("a");

  await wait(80);
  assertEquals(flushed.length, 0);
});
