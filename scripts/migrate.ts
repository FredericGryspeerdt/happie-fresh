// scripts/migrate.ts
//
// One-off, manually-run data migration (`deno task db:migrate`). Idempotent —
// safe to re-run. It (1) rehashes legacy SHA-256 passwords to PBKDF2, (2)
// back-fills a household per user and moves legacy shopping-list items, and
// (3) scopes the previously-global catalogue (items, categories, dishes,
// dish_tag_groups) under a single primary household.
//
// Environment:
//   SEED_PASSWORD    (required) the shared legacy password, used to rehash.
//   PRIMARY_USERNAME (required when more than one household will exist) the
//                    username whose household receives the global catalogue.
//                    When unset, the migration proceeds only if exactly one
//                    household exists; otherwise it fails fast BEFORE mutating
//                    anything. Run this before the app serves traffic so lazy
//                    per-household seeding (e.g. default tag groups) does not
//                    race the catalogue move.
import { getKv } from "@/database/db.ts";
import { HouseholdRepo } from "@/database/household.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { hashPassword, timingSafeEqual } from "@/utils/index.ts";
import { HouseholdInterface, UserInterface } from "@/models/index.ts";

interface LegacyShoppingListItem {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

async function sha256Hex(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Catalogue collections that move from global (`[c, id]`) to household-scoped
 *  (`[c, householdId, id]`). */
const SCOPED_COLLECTIONS = [
  "items",
  "categories",
  "dishes",
  "dish_tag_groups",
] as const;

/**
 * Moves global (length-2) catalogue entries under `householdId`. Idempotent:
 * already-scoped (length-3) keys are skipped, so reruns are safe. Returns the
 * number of entries moved per collection.
 */
export async function scopeGlobalCatalogue(
  kv: Deno.Kv,
  householdId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const collection of SCOPED_COLLECTIONS) {
    let moved = 0;
    for await (const entry of kv.list({ prefix: [collection] })) {
      // key is [collection, id] (global) or [collection, householdId, id].
      if (entry.key.length !== 2) continue; // already scoped → skip
      const id = entry.key[1] as string;
      await kv
        .atomic()
        .set([collection, householdId, id], entry.value)
        .delete(entry.key)
        .commit();
      moved++;
    }
    counts[collection] = moved;
  }
  return counts;
}

/**
 * Resolves which household should own the previously-global catalogue.
 * Uses PRIMARY_USERNAME's household when set; otherwise only auto-resolves when
 * exactly one household exists. Throws rather than guess in an ambiguous DB.
 */
export async function resolvePrimaryHouseholdId(kv: Deno.Kv): Promise<string> {
  const primaryUsername = Deno.env.get("PRIMARY_USERNAME");
  if (primaryUsername) {
    const user = await UserRepo.findByUsername(primaryUsername);
    if (!user) {
      throw new Error(`PRIMARY_USERNAME '${primaryUsername}' not found.`);
    }
    if (!user.householdId) {
      throw new Error(`User '${primaryUsername}' has no household.`);
    }
    return user.householdId;
  }
  const householdIds: string[] = [];
  for await (
    const entry of kv.list<HouseholdInterface>({ prefix: ["households"] })
  ) {
    householdIds.push(entry.value.id);
  }
  if (householdIds.length === 1) return householdIds[0];
  throw new Error(
    `Cannot infer primary household (${householdIds.length} found). ` +
      `Set PRIMARY_USERNAME to choose which household owns the catalogue.`,
  );
}

/** True when any global (length-2) catalogue entry remains to be scoped. */
async function hasGlobalCatalogue(kv: Deno.Kv): Promise<boolean> {
  for (const collection of SCOPED_COLLECTIONS) {
    for await (const entry of kv.list({ prefix: [collection] })) {
      if (entry.key.length === 2) return true;
    }
  }
  return false;
}

/**
 * Fail-fast pre-check, run before migrate() mutates anything: verifies the
 * primary household will be resolvable, so a misconfigured run stops before it
 * half-applies. No-ops when there is no global catalogue left to scope, so a
 * re-run of an already-migrated DB never throws here.
 */
export async function assertPrimaryHouseholdResolvable(
  kv: Deno.Kv,
): Promise<void> {
  if (!(await hasGlobalCatalogue(kv))) return;
  const primaryUsername = Deno.env.get("PRIMARY_USERNAME");
  if (primaryUsername) {
    if (!(await UserRepo.findByUsername(primaryUsername))) {
      throw new Error(`PRIMARY_USERNAME '${primaryUsername}' not found.`);
    }
    return; // its household will exist once the user loop has run
  }
  // Unset: only safe when the run will yield exactly one household.
  let userCount = 0;
  for await (const _ of kv.list({ prefix: ["users"] })) userCount++;
  let householdCount = 0;
  for await (const _ of kv.list({ prefix: ["households"] })) householdCount++;
  const projected = Math.max(userCount, householdCount);
  if (projected > 1) {
    throw new Error(
      `Cannot infer primary household (${projected} expected) and ` +
        `PRIMARY_USERNAME is unset. Set PRIMARY_USERNAME to choose which ` +
        `household owns the migrated catalogue.`,
    );
  }
}

async function migrate() {
  const password = Deno.env.get("SEED_PASSWORD");
  if (!password) {
    console.error("SEED_PASSWORD env var is required.");
    Deno.exit(1);
  }

  const kv = await getKv();
  const legacyHash = await sha256Hex(password);
  const encoder = new TextEncoder();

  let passwordsMigrated = 0;
  let passwordsSkipped = 0;
  let passwordsAlready = 0;
  let usersMigrated = 0;
  let itemsMigrated = 0;

  try {
    // Fail fast before mutating anything if the primary household is ambiguous.
    await assertPrimaryHouseholdResolvable(kv);

    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      if (!user?.id) continue;

      // 1. Rehash legacy SHA-256 passwords to PBKDF2
      if (isLegacyHash(user.passwordHash)) {
        if (
          timingSafeEqual(
            encoder.encode(user.passwordHash),
            encoder.encode(legacyHash),
          )
        ) {
          const newHash = await hashPassword(password);
          await UserRepo.updatePasswordHash(user.id, newHash);
          console.log(`Rehashed password for '${user.username}'`);
          passwordsMigrated++;
          // Re-fetch user so subsequent steps see updated record
          const refreshed = await UserRepo.findById(user.id);
          if (refreshed) Object.assign(user, refreshed);
        } else {
          console.warn(
            `  Skipped password for '${user.username}' — hash does not match SEED_PASSWORD.`,
          );
          passwordsSkipped++;
        }
      } else {
        passwordsAlready++;
      }

      // 2. Create Household and migrate shopping list data
      if (user.householdId) continue;

      console.log(`Migrating household data for '${user.username}'`);

      const household = await HouseholdRepo.create(
        `${user.username}'s household`,
      );

      const updatedUser: UserInterface = { ...user, householdId: household.id };
      await kv
        .atomic()
        .set(["users", user.id], updatedUser)
        .set(["users_by_username", user.username], updatedUser)
        .commit();

      const list = await ShoppingListRepo.create({
        householdId: household.id,
        name: "Shopping List",
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      });

      for await (
        const itemEntry of kv.list<LegacyShoppingListItem>({
          prefix: ["shopping_list", user.id],
        })
      ) {
        const legacy = itemEntry.value;
        const newEntry = await ShoppingListItemRepo.add(list.id, legacy.itemId);
        await ShoppingListItemRepo.update(list.id, newEntry.id, {
          quantity: legacy.quantity,
          note: legacy.note,
          checked: legacy.checked,
        });
        await kv.delete(itemEntry.key);
        itemsMigrated++;
      }

      usersMigrated++;
      console.log(`  Done. household: ${household.id}, list: ${list.id}`);
    }

    // Scope the previously-global catalogue under the primary household.
    const primaryHouseholdId = await resolvePrimaryHouseholdId(kv);
    const scopeCounts = await scopeGlobalCatalogue(kv, primaryHouseholdId);

    console.log(`
Migration complete.
  Passwords: ${passwordsMigrated} rehashed, ${passwordsSkipped} skipped (mismatch), ${passwordsAlready} already PBKDF2
  Households: ${usersMigrated} migrated, ${itemsMigrated} items moved
  Catalogue scoped to household ${primaryHouseholdId}: ${
      JSON.stringify(scopeCounts)
    }`);
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    Deno.exit(1);
  });
}
