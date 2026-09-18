import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { FakeTime } from "jsr:@std/testing@^1.0.18/time";
import {
  createSnackController,
  SNACK_ACTION_MS,
  SNACK_MS,
  snackDuration,
} from "./useSnack.ts";

Deno.test("snackDuration — plain message uses the hook default", () => {
  assertEquals(snackDuration({ defaultMs: SNACK_MS }), SNACK_MS);
  assertEquals(snackDuration({ defaultMs: 2200 }), 2200);
});

Deno.test("snackDuration — an attached action outlives the default", () => {
  assertEquals(
    snackDuration({ defaultMs: SNACK_MS, action: "Undo" }),
    SNACK_ACTION_MS,
  );
  // The action leg is what keeps MoveItems' undo readable; it must not collapse
  // onto the default just because the site lowered it.
  assertEquals(snackDuration({ defaultMs: 6000, action: "Undo" }), 10_000);
});

Deno.test("snackDuration — a per-call override beats both legs", () => {
  assertEquals(snackDuration({ defaultMs: SNACK_MS, overrideMs: 500 }), 500);
  assertEquals(
    snackDuration({ defaultMs: SNACK_MS, action: "Undo", overrideMs: 800 }),
    800,
  );
  // 0 is a value, not "absent": it must not fall through to the default.
  assertEquals(snackDuration({ defaultMs: SNACK_MS, overrideMs: 0 }), 0);
});

Deno.test("snackDuration — a null override means persistent, not zero", () => {
  assertEquals(snackDuration({ defaultMs: SNACK_MS, overrideMs: null }), null);
  // Persistent wins over the action leg too: MoveItems pins "Undoing move…"
  // while the outcome is unknown, and no clock may clear it.
  assertEquals(
    snackDuration({ defaultMs: 6000, action: "Retry", overrideMs: null }),
    null,
  );
});

Deno.test("useSnack — showSnack sets message, action and handler", () => {
  const time = new FakeTime();
  const s = createSnackController();
  try {
    let clicked = 0;
    const onAction = () => clicked++;
    s.showSnack("Cleared this week", "Undo", onAction);
    assertEquals(s.snack.value?.msg, "Cleared this week");
    assertEquals(s.snack.value?.action, "Undo");
    s.snack.value?.onAction?.();
    assertEquals(clicked, 1);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — dismisses itself after the default, sooner with an override", async () => {
  const time = new FakeTime();
  const s = createSnackController();
  try {
    s.showSnack("Saved");
    await time.tickAsync(SNACK_MS - 1);
    assertEquals(s.snack.value?.msg, "Saved");
    await time.tickAsync(1);
    assertEquals(s.snack.value, null);

    s.showSnack("Quick one", undefined, undefined, 400);
    assertEquals(s.snack.value?.msg, "Quick one");
    await time.tickAsync(400);
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — honours the site default over the 3s floor", async () => {
  const time = new FakeTime();
  const s = createSnackController(2200);
  try {
    s.showSnack("Copied");
    await time.tickAsync(2199);
    assertEquals(s.snack.value?.msg, "Copied");
    await time.tickAsync(1);
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — a second call restarts the countdown", async () => {
  const time = new FakeTime();
  const s = createSnackController();
  try {
    s.showSnack("First");
    await time.tickAsync(2000);
    s.showSnack("Second");
    await time.tickAsync(2000); // 2s past the second call, 4s past the first
    assertEquals(s.snack.value?.msg, "Second");
    await time.tickAsync(1000);
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — replacing a live snack resets its timer", async () => {
  const time = new FakeTime();
  const s = createSnackController();
  try {
    // MoveItems swaps "Undoing move…" in over an active Undo snack.
    s.showSnack("Items moved", "Undo", () => {}); // due at t=10_000
    await time.tickAsync(9000);
    s.showSnack("Undoing move…"); // no action → due at t=12_000, not t=10_000
    await time.tickAsync(1000); // t=10_000: the replaced snack's old deadline
    assertEquals(s.snack.value?.msg, "Undoing move…");
    await time.tickAsync(1999); // t=11_999
    assertEquals(s.snack.value?.msg, "Undoing move…");
    await time.tickAsync(1); // t=12_000
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — a null ms stays up until replaced or hidden", async () => {
  const time = new FakeTime();
  const s = createSnackController(6000);
  try {
    s.showSnack("Undoing move…", undefined, undefined, null);
    await time.tickAsync(60_000);
    assertEquals(s.snack.value?.msg, "Undoing move…");
    // The next snack takes over normally, on its own cadence.
    s.showSnack("Items moved back");
    await time.tickAsync(5999);
    assertEquals(s.snack.value?.msg, "Items moved back");
    await time.tickAsync(1);
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — hideSnack clears now and cancels the pending dismiss", async () => {
  const time = new FakeTime();
  const s = createSnackController();
  try {
    s.showSnack("Saved", "Undo", () => {});
    s.hideSnack();
    assertEquals(s.snack.value, null);
    await time.tickAsync(SNACK_ACTION_MS * 2);
    assertEquals(s.snack.value, null);
  } finally {
    s.dispose();
    time.restore();
  }
});

Deno.test("useSnack — dispose cancels the timer, so unmount cannot dismiss (#112)", async () => {
  const time = new FakeTime();
  try {
    const s = createSnackController();
    s.showSnack("Saved");
    s.dispose(); // what useSnack's unmount effect calls
    await time.tickAsync(SNACK_MS * 2);
    // Nothing fired: the visible snack is untouched rather than nulled against a
    // torn-down island.
    assertEquals(s.snack.value?.msg, "Saved");
  } finally {
    time.restore();
  }
});
