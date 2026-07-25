import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { mergeDefinedPatch } from "@/database/merge-patch.ts";

/** Minimal shape covering the fields exercised below. Typed explicitly (rather
 *  than inferred from each literal) so patches touching a key `current` didn't
 *  set — e.g. `checked` in the second test — still type-check against `T`. */
interface TestItem {
  quantity: number;
  note: string;
  checked: boolean;
}

Deno.test("mergeDefinedPatch — a note-only patch preserves quantity and checked", () => {
  const current: Partial<TestItem> = {
    quantity: 2,
    note: "old",
    checked: false,
  };
  const result = mergeDefinedPatch(current, { note: "new" });
  assertEquals(result, { quantity: 2, note: "new", checked: false });
});

Deno.test("mergeDefinedPatch — explicit undefined values are ignored", () => {
  const current: Partial<TestItem> = { quantity: 2, note: "x" };
  const result = mergeDefinedPatch(current, {
    quantity: undefined,
    checked: true,
  });
  assertEquals(result, { quantity: 2, note: "x", checked: true });
});

Deno.test("mergeDefinedPatch — defined falsy values still apply", () => {
  const current: Partial<TestItem> = { checked: true };
  const result = mergeDefinedPatch(current, { checked: false });
  assertEquals(result, { checked: false });
});

Deno.test("mergeDefinedPatch — an empty patch returns an unchanged copy", () => {
  const current: Partial<TestItem> = { quantity: 3, note: "keep" };
  const result = mergeDefinedPatch(current, {});
  assertEquals(result, { quantity: 3, note: "keep" });
});

Deno.test("mergeDefinedPatch — does not mutate the original current object", () => {
  const current: Partial<TestItem> = { quantity: 1, note: "orig" };
  const result = mergeDefinedPatch(current, { note: "changed" });
  assertEquals(current, { quantity: 1, note: "orig" });
  assertEquals(result, { quantity: 1, note: "changed" });
});
