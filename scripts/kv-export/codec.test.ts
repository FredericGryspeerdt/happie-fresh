import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.19";
import {
  decodeValue,
  encodeValue,
  entryToLine,
  hashEntry,
  lineToEntry,
} from "./codec.ts";

function roundTrip(value: unknown): unknown {
  return decodeValue(JSON.parse(JSON.stringify(encodeValue(value))));
}

Deno.test("codec — round-trips the values the repos store", () => {
  const session = {
    userId: "u-1",
    expiresAt: new Date("2026-10-19T10:00:00.123Z"),
    absoluteExpiresAt: new Date("2027-01-17T10:00:00Z"),
  };

  const actual = roundTrip(session) as typeof session;

  const expected = session;
  assertEquals(actual, expected);
  assertEquals(actual.expiresAt instanceof Date, true);
});

Deno.test("codec — round-trips every type JSON cannot hold", () => {
  const value = {
    nothing: undefined,
    big: 12345678901234567890n,
    bytes: new Uint8Array([0, 1, 254, 255]),
    floats: new Float64Array([1.5, -2.25]),
    buffer: new Uint8Array([9, 8, 7]).buffer,
    map: new Map<unknown, unknown>([["a", new Date(0)], [1n, new Set([1])]]),
    set: new Set(["x", "y"]),
    regex: /ab+c/gi,
    numbers: [NaN, Infinity, -Infinity, -0, 0, 1.5],
    invalidDate: new Date(NaN),
    nested: [{ when: new Date(1) }, null, true, "s"],
  };

  const actual = roundTrip(value) as typeof value;

  const expected = value;
  assertEquals(actual, expected);
  assertEquals(Object.is(actual.numbers[3], -0), true);
  assertEquals(Object.hasOwn(actual, "nothing"), true);
});

Deno.test("codec — round-trips a top-level Deno.KvU64", () => {
  const actual = roundTrip(new Deno.KvU64(18446744073709551615n));

  const expected = new Deno.KvU64(18446744073709551615n);
  assertEquals((actual as Deno.KvU64).value, expected.value);
  assertEquals(actual instanceof Deno.KvU64, true);
});

Deno.test("codec — a plain object owning a `$t` key is not read as a tag", () => {
  const value = { $t: "Date", v: "2026-01-01T00:00:00.000Z" };

  const actual = roundTrip(value);

  const expected = value;
  assertEquals(actual, expected);
});

Deno.test("codec — keeps array holes", () => {
  // deno-lint-ignore no-sparse-arrays
  const value = [1, , 3];

  const actual = roundTrip(value) as unknown[];

  assertEquals(actual.length, 3);
  assertEquals(1 in actual, false);
});

Deno.test("codec — refuses values it cannot round-trip", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  assertThrows(() => encodeValue(circular), TypeError, "circular");
  assertThrows(() => encodeValue(new (class Custom {})()), TypeError);
});

Deno.test("codec — an entry line round-trips key parts, value and versionstamp", async () => {
  const entry: Deno.KvEntry<unknown> = {
    key: ["shopping_list_items", "list-1", 3, 7n, true, new Uint8Array([1])],
    value: { name: "Milk", at: new Date(5) },
    versionstamp: "00000000000000010000",
  };

  const line = entryToLine(entry);
  const actual = lineToEntry(line);

  const expected = entry;
  assertEquals(line.includes("\n"), false);
  assertEquals(actual, expected);
  assertEquals(
    await hashEntry(actual.key, actual.value),
    await hashEntry(expected.key, expected.value),
  );
});

Deno.test("codec — hashes differ when a Date becomes a string", async () => {
  const key = ["sessions", "s-1"];
  const when = new Date("2026-10-19T00:00:00.000Z");

  const actual = await hashEntry(key, { expiresAt: when.toISOString() });

  const expected = await hashEntry(key, { expiresAt: when });
  assertEquals(actual === expected, false);
});
