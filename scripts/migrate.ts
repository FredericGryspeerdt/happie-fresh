import { getKv } from "@/database/db.ts";
import { HouseholdRepo } from "@/database/household.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { hashPassword, timingSafeEqual } from "@/utils/index.ts";
import { UserInterface } from "@/models/index.ts";

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

    console.log(`
Migration complete.
  Passwords: ${passwordsMigrated} rehashed, ${passwordsSkipped} skipped (mismatch), ${passwordsAlready} already PBKDF2
  Households: ${usersMigrated} migrated, ${itemsMigrated} items moved`);
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
