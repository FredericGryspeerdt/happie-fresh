import { assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use; set it before any repo/runner call. sanitizeResources is disabled
// because the getKv() singleton is intentionally never closed.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import { isProductionEnv, resetDatabase } from "./runner.ts";

Deno.test("isProductionEnv — true only when a deployment id is present", () => {
  assertEquals(isProductionEnv("some-deploy-id"), true);
  assertEquals(isProductionEnv(""), false);
  assertEquals(isProductionEnv(undefined), false);
});

Deno.test({
  name: "resetDatabase — clears all seed-owned collections",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    const prefixes = [
      ["users"],
      ["users_by_username"],
      ["households"],
      ["categories"],
      ["items"],
      ["shopping_lists"],
      ["shopping_list_items"],
      ["sessions"],
    ];
    // Seed one entry under each prefix.
    for (const p of prefixes) {
      await kv.set([...p, "x"], { marker: true });
    }

    await resetDatabase();

    for (const p of prefixes) {
      let count = 0;
      for await (const _ of kv.list({ prefix: p })) count++;
      assertEquals(count, 0, `prefix ${JSON.stringify(p)} not cleared`);
    }
  },
});
