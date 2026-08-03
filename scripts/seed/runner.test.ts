import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
} from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process. getKv() reads KV_PATH lazily on
// first use; set it before any repo/runner call. sanitizeResources is disabled
// because the getKv() singleton is intentionally never closed.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import {
  isProductionEnv,
  isRemoteKvPath,
  resetDatabase,
  runSeed,
} from "./runner.ts";
import { catalogue, categories, users } from "./fixtures.ts";
import { CategoryRepo } from "@/database/category.repo.ts";
import { ItemRepo } from "@/database/item.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";

Deno.test("isProductionEnv — true only when a deployment id is present", () => {
  assertEquals(isProductionEnv("some-deploy-id"), true);
  assertEquals(isProductionEnv(""), false);
  assertEquals(isProductionEnv(undefined), false);
});

Deno.test("isRemoteKvPath — true only for https:// KV paths", () => {
  assertEquals(isRemoteKvPath("https://api.example.com/db"), true);
  assertEquals(isRemoteKvPath("data/kv.db"), false);
  assertEquals(isRemoteKvPath(":memory:"), false);
  assertEquals(isRemoteKvPath(""), false);
  assertEquals(isRemoteKvPath(undefined), false);
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
      ["dishes"],
      ["dish_tag_groups"],
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

Deno.test({
  name: "runSeed — inserts categories, catalogue, users, lists, and items",
  sanitizeResources: false,
  async fn() {
    await runSeed();

    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user, `user '${fixtureUser.username}' missing`);
      assert(user.householdId.length > 0);
      const hid = user.householdId;

      // Categories: per household, count + contiguous order.
      const seededCategories = await CategoryRepo.getAll(hid);
      assertEquals(seededCategories.length, categories.length);
      assertEquals(
        seededCategories.map((c) => c.order),
        categories.map((_, i) => i),
      );

      // Catalogue: per household, count + referential integrity + uncategorized.
      const seededItems = await ItemRepo.readAll(hid);
      assertEquals(seededItems.length, catalogue.length);
      const categoryIds = new Set(seededCategories.map((c) => c.id));
      for (const item of seededItems) {
        if (item.categoryId !== undefined) {
          assert(
            categoryIds.has(item.categoryId),
            "item has orphan categoryId",
          );
        }
      }
      const expectedUncategorized = catalogue.filter((i) =>
        i.categorySlug === undefined
      ).length;
      const actualUncategorized = seededItems.filter((i) =>
        i.categoryId === undefined
      ).length;
      assertEquals(actualUncategorized, expectedUncategorized);

      // Lists + list items reference this household's catalogue.
      const catalogueNames = new Set(seededItems.map((i) => i.name));
      const lists = await ShoppingListRepo.getAll(hid);
      assertEquals(lists.length, fixtureUser.lists.length);
      for (const fixtureList of fixtureUser.lists) {
        const list = lists.find((l) => l.name === fixtureList.name);
        assertExists(list, `list '${fixtureList.name}' missing`);
        const listItems = await ShoppingListItemRepo.getAll(list.id);
        assertEquals(listItems.length, fixtureList.items.length);
        for (const li of listItems) {
          const item = seededItems.find((i) => i.id === li.itemId);
          assertExists(item, "list item references unknown catalogue item");
          assert(catalogueNames.has(item.name));
        }
      }
    }
  },
});

Deno.test({
  name: "runSeed — a fully-checked list and an empty list both exist",
  sanitizeResources: false,
  async fn() {
    await runSeed();
    let hasFullyChecked = false;
    let hasEmpty = false;
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user);
      const lists = await ShoppingListRepo.getAll(user.householdId);
      for (const list of lists) {
        const items = await ShoppingListItemRepo.getAll(list.id);
        if (items.length === 0) hasEmpty = true;
        if (items.length > 0 && items.every((i) => i.checked)) {
          hasFullyChecked = true;
        }
      }
    }
    assert(hasFullyChecked, "expected a non-empty fully-checked list");
    assert(hasEmpty, "expected an empty list");
  },
});

Deno.test({
  name: "runSeed — is reproducible (reset then reseed yields identical counts)",
  sanitizeResources: false,
  async fn() {
    await runSeed();
    const primary = await UserRepo.findByUsername(users[0].username);
    assertExists(primary);
    const firstCategories =
      (await CategoryRepo.getAll(primary.householdId)).length;
    const firstItems = (await ItemRepo.readAll(primary.householdId)).length;

    await runSeed(); // second run resets and rebuilds

    const primary2 = await UserRepo.findByUsername(users[0].username);
    assertExists(primary2);
    assertEquals(
      (await CategoryRepo.getAll(primary2.householdId)).length,
      firstCategories,
    );
    assertEquals(
      (await ItemRepo.readAll(primary2.householdId)).length,
      firstItems,
    );
    // Exactly the fixture number of users (no duplicates from the second run).
    for (const fixtureUser of users) {
      const user = await UserRepo.findByUsername(fixtureUser.username);
      assertExists(user);
      const lists = await ShoppingListRepo.getAll(user.householdId);
      assertEquals(lists.length, fixtureUser.lists.length);
    }
  },
});

Deno.test({
  name: "runSeed — primary credentials can be overridden",
  sanitizeResources: false,
  async fn() {
    await runSeed({ primaryUsername: "boss", primaryPassword: "s3cret" });
    const overridden = await UserRepo.findByUsername("boss");
    assertExists(overridden, "override username should exist");
    const original = await UserRepo.findByUsername(users[0].username);
    assertEquals(original, null, "default primary username should be replaced");
  },
});

Deno.test({
  name: "runSeed — empty-string overrides fall back to fixture defaults",
  sanitizeResources: false,
  async fn() {
    await runSeed({ primaryUsername: "", primaryPassword: "" });
    assertExists(await UserRepo.findByUsername(users[0].username));
  },
});

Deno.test({
  name:
    "runSeed — primary override colliding with another fixture username rejects",
  sanitizeResources: false,
  async fn() {
    await assertRejects(
      () => runSeed({ primaryUsername: users[1].username }),
      Error,
      "collides",
    );
  },
});
