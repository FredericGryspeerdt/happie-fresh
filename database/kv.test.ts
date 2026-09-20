import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { getKv } from "@/database/db.ts";
import {
  deleteKvValue,
  getKvValue,
  listKvValues,
  setKvValue,
} from "@/database/kv.ts";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name: "KV helpers — operate on complete keys and isolate prefixes",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    for await (const entry of kv.list({ prefix: ["kv-helper-test"] })) {
      await kv.delete(entry.key);
    }

    await setKvValue(["kv-helper-test", "household-a", "one"], { value: 1 });
    await setKvValue(["kv-helper-test", "household-b", "two"], { value: 2 });

    assertEquals(
      await getKvValue<{ value: number }>([
        "kv-helper-test",
        "household-a",
        "one",
      ]),
      { value: 1 },
    );
    assertEquals(
      await listKvValues<{ value: number }>([
        "kv-helper-test",
        "household-a",
      ]),
      [{ value: 1 }],
    );

    await deleteKvValue(["kv-helper-test", "household-a", "one"]);
    assertEquals(
      await getKvValue(["kv-helper-test", "household-a", "one"]),
      null,
    );
  },
});
