import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@^1.0.19";
import {
  assertLocalKvPath,
  exportKv,
  importKv,
  verifyExport,
} from "./kv-export.ts";

async function seeded(): Promise<Deno.Kv> {
  const kv = await Deno.openKv(":memory:");
  await kv.set(["sessions", "s-1"], {
    userId: "u-1",
    expiresAt: new Date("2026-11-18T00:00:00Z"),
  });
  await kv.set(["todos", "h-1", "t-1"], { title: "Bins", done: null });
  await kv.set(["todos", "h-1", "t-2"], {
    title: "Plants",
    tags: new Set(["a"]),
  });
  await kv.set(["counter"], new Deno.KvU64(3n));
  return kv;
}

Deno.test({
  name: "export → restore into an empty KV → verify passes",
  sanitizeResources: false,
  async fn() {
    const dir = await Deno.makeTempDir();
    const file = `${dir}/export.ndjson`;
    const source = await seeded();
    const target = await Deno.openKv(":memory:");

    const exported = await exportKv(source, file);
    const sourceCheck = await verifyExport(source, file, {
      versionstamps: true,
    });
    const restored = await importKv(target, file);
    const actual = await verifyExport(target, file, { versionstamps: false });

    assertEquals(exported.total, 4);
    assertEquals(exported.collections, { sessions: 1, todos: 2, counter: 1 });
    assertEquals(restored.total, 4);
    assertEquals(sourceCheck.ok, true);
    assertEquals(actual.ok, true);
    const expected = (await source.get(["sessions", "s-1"])).value;
    assertEquals((await target.get(["sessions", "s-1"])).value, expected);

    source.close();
    target.close();
    await Deno.remove(dir, { recursive: true });
  },
});

Deno.test({
  name: "verify fails on a changed value, a missing entry or a new write",
  sanitizeResources: false,
  async fn() {
    const dir = await Deno.makeTempDir();
    const file = `${dir}/export.ndjson`;
    const source = await seeded();
    await exportKv(source, file);

    await source.set(["todos", "h-1", "t-1"], { title: "Bins!", done: null });
    await source.set(["todos", "h-1", "t-3"], { title: "New" });
    await source.delete(["counter"]);
    const actual = await verifyExport(source, file, { versionstamps: true });

    assertEquals(actual.ok, false);
    assertEquals(actual.collections.todos.valueMismatches, 1);
    assertEquals(actual.collections.todos.missingFromFile, 1);
    assertEquals(actual.collections.counter.extraInFile, 1);

    source.close();
    await Deno.remove(dir, { recursive: true });
  },
});

Deno.test({
  name: "verify with versionstamps catches a rewrite of an identical value",
  sanitizeResources: false,
  async fn() {
    const dir = await Deno.makeTempDir();
    const file = `${dir}/export.ndjson`;
    const source = await seeded();
    await exportKv(source, file);

    const entry = await source.get(["todos", "h-1", "t-1"]);
    await source.set(entry.key, entry.value);

    const actual = await verifyExport(source, file, { versionstamps: true });

    assertEquals(actual.ok, false);
    assertEquals(actual.collections.todos.versionstampMismatches, 1);
    source.close();
    await Deno.remove(dir, { recursive: true });
  },
});

Deno.test({
  name: "restore refuses a non-empty target",
  sanitizeResources: false,
  async fn() {
    const dir = await Deno.makeTempDir();
    const file = `${dir}/export.ndjson`;
    const source = await seeded();
    await exportKv(source, file);

    await assertRejects(() => importKv(source, file), Error, "non-empty");

    source.close();
    await Deno.remove(dir, { recursive: true });
  },
});

Deno.test("restore refuses remote, missing and Deploy targets", () => {
  const remote = "https://api.deno.com/v2/databases/abc/connect";

  assertThrows(() => assertLocalKvPath(remote, undefined), Error, "remote");
  assertThrows(
    () => assertLocalKvPath(" HTTP://x/y", undefined),
    Error,
    "remote",
  );
  assertThrows(() => assertLocalKvPath(undefined, undefined), Error, "KV_PATH");
  assertThrows(
    () => assertLocalKvPath("data/r.db", "deploy-1"),
    Error,
    "Deploy",
  );
  assertLocalKvPath("data/restore.db", undefined);
});
