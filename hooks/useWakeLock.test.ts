import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { shouldRequestLock } from "./useWakeLock.ts";

Deno.test("shouldRequestLock — holds only when supported, visible and wanted", () => {
  assertEquals(
    shouldRequestLock({ supported: true, visible: true, wanted: true }),
    true,
  );
});

Deno.test("shouldRequestLock — any missing leg refuses the lock", () => {
  assertEquals(
    shouldRequestLock({ supported: false, visible: true, wanted: true }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: true, visible: false, wanted: true }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: true, visible: true, wanted: false }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: false, visible: false, wanted: false }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: false, visible: false, wanted: true }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: true, visible: false, wanted: false }),
    false,
  );
  assertEquals(
    shouldRequestLock({ supported: false, visible: true, wanted: false }),
    false,
  );
});
