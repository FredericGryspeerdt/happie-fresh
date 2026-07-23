import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import { usePullToRefresh } from "@/hooks/usePullToRefresh.ts";

Deno.test("usePullToRefresh — pull below threshold springs back, no refresh", () => {
  let calls = 0;
  const c = usePullToRefresh({
    threshold: 72,
    resistance: 0.5,
    onRefresh: () => {
      calls++;
      return Promise.resolve();
    },
  });
  c.begin(100);
  const engaged = c.move(220, true); // raw 120 * 0.5 = 60 < 72
  assert(engaged);
  assertEquals(c.status.value, "pulling");
  assertEquals(c.pull.value, 60);
  c.end();
  assertEquals(c.status.value, "idle");
  assertEquals(c.pull.value, 0);
  assertEquals(calls, 0);
});

Deno.test("usePullToRefresh — past threshold arms, then refreshes and succeeds", async () => {
  const time = new FakeTime();
  try {
    let calls = 0;
    // deno-lint-ignore react-rules-of-hooks
    const c = usePullToRefresh({
      threshold: 72,
      resistance: 0.5,
      onRefresh: () => {
        calls++;
        return Promise.resolve();
      },
    });
    c.begin(0);
    c.move(200, true); // raw 200 * 0.5 = 100 >= 72 → armed
    assertEquals(c.status.value, "armed");
    c.end();
    assertEquals(c.status.value, "refreshing");
    assertEquals(calls, 1);
    await time.tickAsync(0); // flush onRefresh microtasks
    assertEquals(c.status.value, "success");
    await time.tickAsync(600);
    assertEquals(c.status.value, "idle");
    assertEquals(c.pull.value, 0);
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — rejection goes to error then idle and calls onError", async () => {
  const time = new FakeTime();
  try {
    let errored: unknown = null;
    // deno-lint-ignore react-rules-of-hooks
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => Promise.reject(new Error("boom")),
      onError: (e: unknown) => (errored = e),
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    await time.tickAsync(0);
    assertEquals(c.status.value, "error");
    assert(errored instanceof Error);
    await time.tickAsync(400);
    assertEquals(c.status.value, "idle");
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — does not engage when not scrolled to top", () => {
  let calls = 0;
  const c = usePullToRefresh({
    onRefresh: () => {
      calls++;
      return Promise.resolve();
    },
  });
  c.begin(0);
  const engaged = c.move(200, false); // atTop = false
  assertEquals(engaged, false);
  assertEquals(c.status.value, "idle");
  c.end();
  assertEquals(calls, 0);
});

Deno.test("usePullToRefresh — ignores new gestures while refreshing", async () => {
  const time = new FakeTime();
  try {
    let calls = 0;
    // deno-lint-ignore react-rules-of-hooks
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => {
        calls++;
        return Promise.resolve();
      },
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    assertEquals(c.status.value, "refreshing");
    c.begin(0);
    assertEquals(c.move(300, true), false); // no-op mid-refresh
    c.end();
    await time.tickAsync(0);
    assertEquals(calls, 1);
    await time.tickAsync(600);
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — resistance damps pull distance", () => {
  const c = usePullToRefresh({
    threshold: 72,
    resistance: 0.4,
    onRefresh: () => Promise.resolve(),
  });
  c.begin(0);
  c.move(100, true); // 100 * 0.4 = 40
  assertEquals(c.pull.value, 40);
});

Deno.test("usePullToRefresh — synchronous throw in onRefresh goes to error, not stuck refreshing", async () => {
  const time = new FakeTime();
  try {
    let errored: unknown = null;
    // deno-lint-ignore react-rules-of-hooks
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => {
        throw new Error("sync boom");
      },
      onError: (e) => (errored = e),
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    assertEquals(c.status.value, "error"); // caught synchronously, not stuck at "refreshing"
    assert(errored instanceof Error);
    await time.tickAsync(400);
    assertEquals(c.status.value, "idle");
  } finally {
    time.restore();
  }
});

Deno.test("usePullToRefresh — cancel() aborts an in-progress pull", () => {
  const c = usePullToRefresh({
    threshold: 72,
    onRefresh: () => Promise.resolve(),
  });
  c.begin(0);
  c.move(80, true); // 80 * 0.5 = 40 → pulling
  assertEquals(c.status.value, "pulling");
  c.cancel();
  assertEquals(c.status.value, "idle");
  assertEquals(c.pull.value, 0);
});

Deno.test("usePullToRefresh — ignores new gestures during the error linger", async () => {
  const time = new FakeTime();
  try {
    // deno-lint-ignore react-rules-of-hooks
    const c = usePullToRefresh({
      threshold: 72,
      onRefresh: () => Promise.reject(new Error("boom")),
    });
    c.begin(0);
    c.move(300, true);
    c.end();
    await time.tickAsync(0);
    assertEquals(c.status.value, "error");
    // A new gesture during the error window is ignored (no clobber).
    c.begin(0);
    assertEquals(c.move(300, true), false);
    assertEquals(c.status.value, "error");
    await time.tickAsync(400);
    assertEquals(c.status.value, "idle");
  } finally {
    time.restore();
  }
});
