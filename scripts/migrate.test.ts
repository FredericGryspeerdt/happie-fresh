import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import {
  assertPrimaryHouseholdResolvable,
  migrateCatalogue,
  resolvePrimaryHouseholdId,
  scopeGlobalCatalogue,
} from "./migrate.ts";

async function clearCatalogue() {
  const kv = await getKv();
  for (const c of ["items", "categories", "dishes", "dish_tag_groups"]) {
    for await (const e of kv.list({ prefix: [c] })) await kv.delete(e.key);
  }
}

Deno.test({
  name:
    "scopeGlobalCatalogue — moves globals under the household, deletes globals",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await kv.set(["categories", "c1"], { id: "c1", label: "Dairy" });
    await kv.set(["dishes", "d1"], { id: "d1", name: "Curry" });
    await kv.set(["dish_tag_groups", "g1"], {
      id: "g1",
      label: "Type",
      values: [],
    });

    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts, {
      items: 1,
      categories: 1,
      dishes: 1,
      dish_tag_groups: 1,
    });

    // Global keys removed; scoped keys present.
    assertEquals((await kv.get(["items", "i1"])).value, null);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    assertEquals((await kv.get(["dishes", "hh-1", "d1"])).value, {
      id: "d1",
      name: "Curry",
    });
  },
});

Deno.test({
  name: "scopeGlobalCatalogue — idempotent; leaves already-scoped entries",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await scopeGlobalCatalogue(kv, "hh-1");

    // Second run: nothing global left to move.
    const counts = await scopeGlobalCatalogue(kv, "hh-1");
    assertEquals(counts.items, 0);
    assertEquals((await kv.get(["items", "hh-1", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
    // No stray global (length-2) key reappeared.
    let globals = 0;
    for await (const e of kv.list({ prefix: ["items"] })) {
      if (e.key.length === 2) globals++;
    }
    assertEquals(globals, 0);
  },
});

async function clearIdentity() {
  const kv = await getKv();
  for (const c of ["users", "users_by_username", "households"]) {
    for await (const e of kv.list({ prefix: [c] })) await kv.delete(e.key);
  }
}

async function addUserWithHousehold(username: string, householdId: string) {
  const kv = await getKv();
  const user = {
    id: `u-${username}`,
    username,
    passwordHash: "x",
    householdId,
  };
  await kv
    .atomic()
    .set(["users", user.id], user)
    .set(["users_by_username", username], user)
    .set(["households", householdId], { id: householdId, name: username })
    .commit();
}

Deno.test({
  name: "resolvePrimaryHouseholdId — returns PRIMARY_USERNAME's household",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearIdentity();
    await addUserWithHousehold("alice", "hh-alice");
    await addUserWithHousehold("bob", "hh-bob");
    Deno.env.set("PRIMARY_USERNAME", "bob");
    try {
      assertEquals(await resolvePrimaryHouseholdId(kv), "hh-bob");
    } finally {
      Deno.env.delete("PRIMARY_USERNAME");
    }
  },
});

Deno.test({
  name:
    "resolvePrimaryHouseholdId — sole household when PRIMARY_USERNAME unset",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    await addUserWithHousehold("solo", "hh-solo");
    assertEquals(await resolvePrimaryHouseholdId(kv), "hh-solo");
  },
});

Deno.test({
  name: "resolvePrimaryHouseholdId — throws when ambiguous and unset",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    await addUserWithHousehold("a", "hh-a");
    await addUserWithHousehold("b", "hh-b");
    await assertRejects(
      () => resolvePrimaryHouseholdId(kv),
      Error,
      "Cannot infer primary household",
    );
  },
});

Deno.test({
  name: "assertPrimaryHouseholdResolvable — no-op when no global catalogue",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    // Two households + unset would be ambiguous, but with nothing to scope the
    // pre-check must not throw.
    await addUserWithHousehold("a", "hh-a");
    await addUserWithHousehold("b", "hh-b");
    await assertPrimaryHouseholdResolvable(kv);
  },
});

Deno.test({
  name:
    "assertPrimaryHouseholdResolvable — throws before mutating when ambiguous",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await addUserWithHousehold("a", "hh-a");
    await addUserWithHousehold("b", "hh-b");
    await assertRejects(
      () => assertPrimaryHouseholdResolvable(kv),
      Error,
      "Cannot infer primary household",
    );
  },
});

Deno.test({
  name:
    "assertPrimaryHouseholdResolvable — passes when PRIMARY_USERNAME set to an existing user",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });
    await addUserWithHousehold("a", "hh-a");
    await addUserWithHousehold("b", "hh-b");
    Deno.env.set("PRIMARY_USERNAME", "a");
    try {
      await assertPrimaryHouseholdResolvable(kv);
    } finally {
      Deno.env.delete("PRIMARY_USERNAME");
    }
  },
});

Deno.test({
  name:
    "migrateCatalogue — no-op (null) on an empty KV, even with no household (preview deploy)",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    // Empty KV: no users, no households, no global catalogue — the fresh
    // preview-deploy case. Must not throw "Cannot infer primary household".
    assertEquals(await migrateCatalogue(kv), null);
  },
});

Deno.test({
  name:
    "migrateCatalogue — returns null when only already-scoped entries exist",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    // Already-migrated: only length-3 (scoped) keys remain.
    await kv.set(["items", "hh-x", "i1"], { id: "i1", name: "Milk" });
    assertEquals(await migrateCatalogue(kv), null);
    // The already-scoped entry is untouched.
    assertEquals((await kv.get(["items", "hh-x", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
  },
});

Deno.test({
  name: "migrateCatalogue — scopes global entries to the sole household",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearCatalogue();
    await clearIdentity();
    Deno.env.delete("PRIMARY_USERNAME");
    await addUserWithHousehold("solo", "hh-solo");
    await kv.set(["items", "i1"], { id: "i1", name: "Milk" });

    const result = await migrateCatalogue(kv);
    assertEquals(result?.householdId, "hh-solo");
    assertEquals(result?.counts.items, 1);
    // Global key moved under the sole household.
    assertEquals((await kv.get(["items", "i1"])).value, null);
    assertEquals((await kv.get(["items", "hh-solo", "i1"])).value, {
      id: "i1",
      name: "Milk",
    });
  },
});
