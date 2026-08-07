// scripts/dedupe-dish-tag-groups.ts
//
// One-off, manually-run cleanup for duplicated dish tag groups ("Type",
// "Meal", "Side type"). The issue-#42 catalogue migration warned that lazy
// per-household seeding (DishTagGroupRepo.ensureDefaults) could race the
// catalogue move: a /menu visit before the migration seeded fresh default
// groups, and the migration then moved the old global groups under the same
// household — leaving two copies of each group.
//
// For every household, groups with the same (trimmed, case-insensitive) label
// are merged into one keeper — the copy whose values dishes actually
// reference. Same-label values of the losing copies are dropped (dishes
// referencing them are rewritten to the keeper's value), and values with a
// label the keeper lacks (user-added customs) are moved into the keeper.
//
// DRY RUN by default: prints the plan and mutates nothing. Pass --apply to
// commit. Idempotent — after an apply, a re-run finds nothing to do.
//
// Environment: the usual KV selection (KV_PATH / DENO_KV_ACCESS_TOKEN for a
// remote KV Connect run — see docs/running-migrations.md).
import { getKv } from "@/database/db.ts";
import {
  DishInterface,
  DishTagGroupInterface,
  DishTagValueInterface,
} from "@/models/index.ts";

export interface DishRewrite {
  dishId: string;
  tagValueIds: string[];
}

export interface GroupMergePlan {
  label: string;
  keepId: string;
  deleteIds: string[];
  /** The keeper with the losers' unmatched values merged in. */
  keptGroup: DishTagGroupInterface;
  /** Loser values dropped because the keeper has a same-label value. */
  droppedValues: DishTagValueInterface[];
  /** Loser values moved into the keeper (label not present there). */
  movedValues: DishTagValueInterface[];
  /** Dishes whose tagValueIds change, with their final (fully-remapped) ids. */
  dishRewrites: DishRewrite[];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Plans the merge of same-label dish tag groups for one household. Pure —
 * mutates nothing. The keeper of each label is the copy with the most
 * dish-referenced values (ties: more values, lower order, lower id).
 * `dishRewrites` carry each dish's final ids across ALL merged labels, so
 * applying the rewrites of any one plan entry never undoes another's.
 */
export function planDedupe(
  groups: DishTagGroupInterface[],
  dishes: DishInterface[],
): GroupMergePlan[] {
  // How many dishes reference each value id — the keeper of a duplicated
  // label is the copy with the most dish references (fewest rewrites).
  const referenceCount = new Map<string, number>();
  for (const d of dishes) {
    for (const id of d.tagValueIds) {
      referenceCount.set(id, (referenceCount.get(id) ?? 0) + 1);
    }
  }
  const buckets = new Map<string, DishTagGroupInterface[]>();
  for (const g of groups) {
    const key = norm(g.label);
    buckets.set(key, [...(buckets.get(key) ?? []), g]);
  }

  // dropped value id → keeper value id, across all duplicated labels.
  const remap = new Map<string, string>();
  // plan entry → the dropped ids that belong to it, to attach rewrites below.
  const droppedIdsByPlan: Set<string>[] = [];
  const plans: GroupMergePlan[] = [];

  for (const copies of buckets.values()) {
    if (copies.length < 2) continue;
    const refCount = (g: DishTagGroupInterface) =>
      g.values.reduce((sum, v) => sum + (referenceCount.get(v.id) ?? 0), 0);
    const ranked = [...copies].sort((a, b) =>
      refCount(b) - refCount(a) ||
      b.values.length - a.values.length ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.id.localeCompare(b.id)
    );
    const [keeper, ...losers] = ranked;

    const mergedValues = [...keeper.values];
    const droppedValues: DishTagValueInterface[] = [];
    const movedValues: DishTagValueInterface[] = [];
    const droppedIds = new Set<string>();
    for (const loser of losers) {
      for (const value of loser.values) {
        const match = mergedValues.find((v) =>
          norm(v.label) === norm(value.label)
        );
        if (match) {
          remap.set(value.id, match.id);
          droppedIds.add(value.id);
          droppedValues.push(value);
        } else {
          mergedValues.push(value);
          movedValues.push(value);
        }
      }
    }

    droppedIdsByPlan.push(droppedIds);
    plans.push({
      label: keeper.label,
      keepId: keeper.id,
      deleteIds: losers.map((l) => l.id),
      keptGroup: { ...keeper, values: mergedValues },
      droppedValues,
      movedValues,
      dishRewrites: [],
    });
  }

  // Rewrite dishes once, against the global remap, then attach each rewrite
  // to every plan entry whose dropped values the dish referenced.
  for (const d of dishes) {
    const next: string[] = [];
    for (const id of d.tagValueIds) {
      const mapped = remap.get(id) ?? id;
      if (!next.includes(mapped)) next.push(mapped);
    }
    const changed = next.length !== d.tagValueIds.length ||
      next.some((id, i) => id !== d.tagValueIds[i]);
    if (!changed) continue;
    const rewrite: DishRewrite = { dishId: d.id, tagValueIds: next };
    plans.forEach((plan, i) => {
      if (d.tagValueIds.some((id) => droppedIdsByPlan[i].has(id))) {
        plan.dishRewrites.push(rewrite);
      }
    });
  }

  return plans;
}

/**
 * Plans (and with `apply` set, commits) the dedupe for every household that
 * has duplicated tag-group labels. Returns the plans keyed by household id;
 * households with nothing to merge are omitted.
 */
export async function dedupeDishTagGroups(
  kv: Deno.Kv,
  apply: boolean,
): Promise<Record<string, GroupMergePlan[]>> {
  const groupsByHousehold = new Map<string, DishTagGroupInterface[]>();
  for await (
    const entry of kv.list<DishTagGroupInterface>({
      prefix: ["dish_tag_groups"],
    })
  ) {
    // Keys are ["dish_tag_groups", householdId, groupId]; an unscoped
    // (length-2) key would predate the issue-#42 migration — leave it alone.
    if (entry.key.length !== 3) {
      console.warn(`  Skipping unscoped key ${JSON.stringify(entry.key)}`);
      continue;
    }
    const householdId = entry.key[1] as string;
    groupsByHousehold.set(householdId, [
      ...(groupsByHousehold.get(householdId) ?? []),
      entry.value,
    ]);
  }

  const report: Record<string, GroupMergePlan[]> = {};
  for (const [householdId, groups] of groupsByHousehold) {
    const dishes: DishInterface[] = [];
    for await (
      const entry of kv.list<DishInterface>({ prefix: ["dishes", householdId] })
    ) dishes.push(entry.value);

    const plans = planDedupe(groups, dishes);
    if (plans.length === 0) continue;
    report[householdId] = plans;

    if (!apply) continue;
    let atomic = kv.atomic();
    const rewrittenDishes = new Map<string, string[]>();
    for (const plan of plans) {
      atomic = atomic.set(
        ["dish_tag_groups", householdId, plan.keepId],
        plan.keptGroup,
      );
      for (const id of plan.deleteIds) {
        atomic = atomic.delete(["dish_tag_groups", householdId, id]);
      }
      for (const rw of plan.dishRewrites) {
        rewrittenDishes.set(rw.dishId, rw.tagValueIds);
      }
    }
    for (const [dishId, tagValueIds] of rewrittenDishes) {
      const dish = dishes.find((d) => d.id === dishId);
      if (!dish) continue;
      atomic = atomic.set(["dishes", householdId, dishId], {
        ...dish,
        tagValueIds,
      });
    }
    const ok = await atomic.commit();
    if (!ok.ok) {
      throw new Error(`Dedupe commit failed for household ${householdId}.`);
    }
  }
  return report;
}

async function main() {
  const apply = Deno.args.includes("--apply");
  const kv = await getKv();
  try {
    const report = await dedupeDishTagGroups(kv, apply);
    const households = Object.keys(report);
    if (households.length === 0) {
      console.log("No duplicated dish tag groups found. Nothing to do.");
      return;
    }
    for (const householdId of households) {
      console.log(`\nHousehold ${householdId}:`);
      for (const plan of report[householdId]) {
        console.log(
          `  "${plan.label}": keep ${plan.keepId}, delete ${
            plan.deleteIds.join(", ")
          }`,
        );
        console.log(
          `    values kept: ${
            plan.keptGroup.values.map((v) => v.label).join(", ")
          }`,
        );
        if (plan.movedValues.length > 0) {
          console.log(
            `    moved from losing copy: ${
              plan.movedValues.map((v) => v.label).join(", ")
            }`,
          );
        }
        if (plan.droppedValues.length > 0) {
          console.log(
            `    dropped duplicates: ${plan.droppedValues.length} value(s)`,
          );
        }
        for (const rw of plan.dishRewrites) {
          console.log(
            `    rewrite dish ${rw.dishId} → [${rw.tagValueIds.join(", ")}]`,
          );
        }
      }
    }
    console.log(
      apply
        ? "\nApplied. Re-run without --apply to verify nothing remains."
        : "\nDRY RUN — nothing was changed. Re-run with --apply to commit.",
    );
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Dedupe failed:", err);
    Deno.exit(1);
  });
}
