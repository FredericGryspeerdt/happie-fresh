import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { devAutoLoginUsername } from "./dev-auth.ts";

// devAutoLoginUsername decides, from environment values, which seeded user the
// dev server should auto-authenticate as — or null when auto-login must not
// apply. It is pure so the decision can be tested without a live request.

Deno.test("devAutoLoginUsername — null in production regardless of other vars", () => {
  assertEquals(devAutoLoginUsername("deploy-abc", undefined, undefined), null);
  assertEquals(devAutoLoginUsername("deploy-abc", "true", "alex"), null);
});

Deno.test("devAutoLoginUsername — defaults to 'demo' in dev", () => {
  assertEquals(devAutoLoginUsername(undefined, undefined, undefined), "demo");
});

Deno.test("devAutoLoginUsername — disabled by DEV_AUTOLOGIN=false", () => {
  assertEquals(devAutoLoginUsername(undefined, "false", "alex"), null);
});

Deno.test("devAutoLoginUsername — uses SEED_USERNAME when set", () => {
  assertEquals(devAutoLoginUsername(undefined, undefined, "alex"), "alex");
});

Deno.test("devAutoLoginUsername — empty SEED_USERNAME falls back to 'demo'", () => {
  assertEquals(devAutoLoginUsername(undefined, undefined, ""), "demo");
});

Deno.test("devAutoLoginUsername — explicit DEV_AUTOLOGIN=true stays enabled", () => {
  assertEquals(devAutoLoginUsername(undefined, "true", undefined), "demo");
});
