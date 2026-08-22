import { assertEquals } from "jsr:@std/assert@^1.0.19";

// Isolated in-memory KV for this test process.
Deno.env.set("KV_PATH", ":memory:");

import { getKv } from "@/database/db.ts";
import { DishInterface, DishTagGroupInterface } from "@/models/index.ts";
import { dedupeDishTagGroups, planDedupe } from "./dedupe-dish-tag-groups.ts";

function group(
  id: string,
  label: string,
  values: { id: string; label: string }[],
  order = 0,
): DishTagGroupInterface {
  return { id, label, order, values };
}

function dish(id: string, tagValueIds: string[]): DishInterface {
  return { id, name: `dish-${id}`, ingredientIds: [], tagValueIds };
}

Deno.test("planDedupe — no duplicate labels → empty plan", () => {
  const groups = [
    group("g1", "Type", [{ id: "v1", label: "Meat" }]),
    group("g2", "Meal", [{ id: "v2", label: "Lunch" }]),
  ];
  assertEquals(planDedupe(groups, []), []);
});

Deno.test("planDedupe — keeps the copy whose values dishes reference", () => {
  const migrated = group("g-old", "Type", [
    { id: "v-old-1", label: "Vegetarian" },
    { id: "v-old-2", label: "Meat" },
  ], 0);
  const seeded = group("g-new", "Type", [
    { id: "v-new-1", label: "Vegetarian" },
    { id: "v-new-2", label: "Meat" },
  ], 0);
  const dishes = [dish("d1", ["v-old-2"])];

  const plan = planDedupe([seeded, migrated], dishes);
  assertEquals(plan.length, 1);
  assertEquals(plan[0].keepId, "g-old");
  assertEquals(plan[0].deleteIds, ["g-new"]);
  // Same-label values of the pristine copy are dropped, not merged.
  assertEquals(plan[0].keptGroup.values, migrated.values);
  assertEquals(plan[0].dishRewrites, []);
});

Deno.test("planDedupe — moves custom (unmatched-label) values into the keeper", () => {
  const migrated = group("g-old", "Side type", [
    { id: "v-old-1", label: "Rice" },
  ]);
  const seeded = group("g-new", "Side type", [
    { id: "v-new-1", label: "Rice" },
    { id: "v-custom", label: "Couscous" }, // user-added on the losing copy
  ]);
  const dishes = [dish("d1", ["v-old-1"])];

  const plan = planDedupe([migrated, seeded], dishes);
  assertEquals(plan[0].keepId, "g-old");
  assertEquals(plan[0].keptGroup.values, [
    { id: "v-old-1", label: "Rice" },
    { id: "v-custom", label: "Couscous" },
  ]);
});

Deno.test("planDedupe — rewrites dishes referencing a dropped same-label value", () => {
  const migrated = group("g-old", "Type", [
    { id: "v-old-meat", label: "Meat" },
  ]);
  const seeded = group("g-new", "Type", [
    { id: "v-new-meat", label: "Meat" },
  ]);
  // Two dishes tagged via the migrated copy, one via the seeded copy: the
  // migrated copy wins (most dish references) and the odd one out is rewritten.
  const dishes = [
    dish("d1", ["v-old-meat"]),
    dish("d2", ["v-old-meat"]),
    dish("d3", ["v-new-meat", "unrelated-id"]),
  ];

  const plan = planDedupe([migrated, seeded], dishes);
  assertEquals(plan[0].keepId, "g-old");
  assertEquals(plan[0].dishRewrites, [
    { dishId: "d3", tagValueIds: ["v-old-meat", "unrelated-id"] },
  ]);
});

Deno.test("planDedupe — a dish referencing both copies ends with one deduped id", () => {
  // Symmetric references (one each) → tie broken by lowest group id: g-a wins.
  const a = group("g-a", "Type", [{ id: "va", label: "Meat" }]);
  const b = group("g-b", "Type", [{ id: "vb", label: "Meat" }]);
  const dishes = [dish("d1", ["va", "vb"])];

  const plan = planDedupe([a, b], dishes);
  assertEquals(plan[0].keepId, "g-a");
  assertEquals(plan[0].dishRewrites, [
    { dishId: "d1", tagValueIds: ["va"] },
  ]);
});

Deno.test("planDedupe — no references at all → keeps exactly one copy deterministically", () => {
  const a = group("g-a", "Meal", [{ id: "va", label: "Lunch" }], 1);
  const b = group("g-b", "Meal", [{ id: "vb", label: "Lunch" }], 1);

  const plan = planDedupe([a, b], []);
  assertEquals(plan.length, 1);
  // Tie on references and value count → lowest id wins for determinism.
  assertEquals(plan[0].keepId, "g-a");
  assertEquals(plan[0].deleteIds, ["g-b"]);
  assertEquals(plan[0].keptGroup.values, [{ id: "va", label: "Lunch" }]);
});

Deno.test("planDedupe — matches group labels case-insensitively and trimmed", () => {
  const a = group("g-a", "Type", [{ id: "va", label: "Meat" }]);
  const b = group("g-b", " type ", [{ id: "vb", label: "meat" }]);

  const plan = planDedupe([a, b], [dish("d1", ["va"])]);
  assertEquals(plan.length, 1);
  assertEquals(plan[0].keepId, "g-a");
  // "meat" matches "Meat" → dropped, not duplicated into the keeper.
  assertEquals(plan[0].keptGroup.values, [{ id: "va", label: "Meat" }]);
});

async function clearMenuData() {
  const kv = await getKv();
  for (const c of ["dishes", "dish_tag_groups"]) {
    for await (const e of kv.list({ prefix: [c] })) await kv.delete(e.key);
  }
}

async function seedDuplicatedHousehold(householdId: string) {
  const kv = await getKv();
  await kv.set(
    ["dish_tag_groups", householdId, "g-old"],
    group("g-old", "Type", [
      { id: "v-old-meat", label: "Meat" },
    ]),
  );
  await kv.set(
    ["dish_tag_groups", householdId, "g-new"],
    group("g-new", "Type", [
      { id: "v-new-meat", label: "Meat" },
    ]),
  );
  // Two dishes on the migrated copy, one on the seeded copy.
  await kv.set(["dishes", householdId, "d1"], dish("d1", ["v-old-meat"]));
  await kv.set(["dishes", householdId, "d2"], dish("d2", ["v-old-meat"]));
  await kv.set(["dishes", householdId, "d3"], dish("d3", ["v-new-meat"]));
}

Deno.test({
  name:
    "dedupeDishTagGroups — dry run (apply=false) reports but mutates nothing",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearMenuData();
    await seedDuplicatedHousehold("hh-1");

    const report = await dedupeDishTagGroups(kv, false);
    assertEquals(Object.keys(report), ["hh-1"]);
    assertEquals(report["hh-1"].length, 1);
    assertEquals(report["hh-1"][0].deleteIds, ["g-new"]);

    // Nothing changed.
    assertEquals(
      ((await kv.get(["dish_tag_groups", "hh-1", "g-new"])).value as
        | DishTagGroupInterface
        | null)?.id,
      "g-new",
    );
    assertEquals(
      ((await kv.get(["dishes", "hh-1", "d3"])).value as DishInterface)
        .tagValueIds,
      ["v-new-meat"],
    );
  },
});

Deno.test({
  name:
    "dedupeDishTagGroups — apply merges groups, deletes losers, rewrites dishes",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearMenuData();
    await seedDuplicatedHousehold("hh-1");

    await dedupeDishTagGroups(kv, true);

    assertEquals(
      (await kv.get(["dish_tag_groups", "hh-1", "g-new"])).value,
      null,
    );
    const kept = (await kv.get(["dish_tag_groups", "hh-1", "g-old"]))
      .value as DishTagGroupInterface;
    assertEquals(kept.values, [{ id: "v-old-meat", label: "Meat" }]);
    // The dish tagged via the deleted copy is remapped; the others untouched.
    const d3 = (await kv.get(["dishes", "hh-1", "d3"])).value as DishInterface;
    assertEquals(d3.tagValueIds, ["v-old-meat"]);
    const d1 = (await kv.get(["dishes", "hh-1", "d1"])).value as DishInterface;
    assertEquals(d1.tagValueIds, ["v-old-meat"]);

    // Idempotent: a second pass finds nothing to do.
    const again = await dedupeDishTagGroups(kv, false);
    assertEquals(again, {});
  },
});

Deno.test({
  name: "dedupeDishTagGroups — households without duplicates are untouched",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    await clearMenuData();
    await seedDuplicatedHousehold("hh-1");
    await kv.set(
      ["dish_tag_groups", "hh-2", "g-solo"],
      group("g-solo", "Type", [{ id: "v1", label: "Fish" }]),
    );

    const report = await dedupeDishTagGroups(kv, true);
    assertEquals(Object.keys(report), ["hh-1"]);
    const solo = (await kv.get(["dish_tag_groups", "hh-2", "g-solo"]))
      .value as DishTagGroupInterface;
    assertEquals(solo.values, [{ id: "v1", label: "Fish" }]);
  },
});
