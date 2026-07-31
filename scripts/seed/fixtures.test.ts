import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { catalogue, categories, users } from "./fixtures.ts";

Deno.test("fixtures — category slugs are unique", () => {
  const slugs = categories.map((c) => c.slug);
  assertEquals(new Set(slugs).size, slugs.length);
});

Deno.test("fixtures — category orders are contiguous from 0", () => {
  const orders = categories.map((c) => c.order).sort((a, b) => a - b);
  assertEquals(orders, categories.map((_, i) => i));
});

Deno.test("fixtures — catalogue slugs are unique", () => {
  const slugs = catalogue.map((i) => i.slug);
  assertEquals(new Set(slugs).size, slugs.length);
});

Deno.test("fixtures — every item categorySlug references a real category", () => {
  const categorySlugs = new Set(categories.map((c) => c.slug));
  for (const item of catalogue) {
    if (item.categorySlug !== undefined) {
      assert(
        categorySlugs.has(item.categorySlug),
        `item '${item.slug}' references unknown category '${item.categorySlug}'`,
      );
    }
  }
});

Deno.test("fixtures — at least one uncategorized catalogue item exists", () => {
  assert(catalogue.some((i) => i.categorySlug === undefined));
});

Deno.test("fixtures — every list item references a real catalogue item", () => {
  const itemSlugs = new Set(catalogue.map((i) => i.slug));
  for (const user of users) {
    for (const list of user.lists) {
      for (const li of list.items) {
        assert(
          itemSlugs.has(li.itemSlug),
          `list '${list.name}' references unknown item '${li.itemSlug}'`,
        );
      }
    }
  }
});

Deno.test("fixtures — usernames are unique", () => {
  const names = users.map((u) => u.username);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("fixtures — includes required edge cases", () => {
  const lists = users.flatMap((u) => u.lists);
  // A non-empty, fully-checked list ("everything bought").
  assert(
    lists.some((l) => l.items.length > 0 && l.items.every((i) => i.checked)),
    "expected a non-empty fully-checked list",
  );
  // An empty list.
  assert(lists.some((l) => l.items.length === 0), "expected an empty list");
  // A high-quantity item.
  assert(
    lists.some((l) => l.items.some((i) => i.quantity >= 20)),
    "expected a high-quantity item",
  );
});
