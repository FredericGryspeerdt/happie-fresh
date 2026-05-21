import { getKv } from "@/database/db.ts";
import { HouseholdRepo } from "@/database/household.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { UserInterface } from "@/models/index.ts";

interface LegacyShoppingListItem {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  note?: string;
  checked: boolean;
}

async function migrate() {
  const kv = await getKv();
  let migratedUsers = 0;
  let migratedItems = 0;

  for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
    const user = entry.value;

    // Skip secondary index entries and already-migrated users
    if (!user?.id || user.householdId) continue;

    console.log(`Migrating user: ${user.username}`);

    // 1. Create household
    const household = await HouseholdRepo.create(
      `${user.username}'s household`,
    );

    // 2. Update user with householdId
    const updatedUser: UserInterface = { ...user, householdId: household.id };
    await kv
      .atomic()
      .set(["users", user.id], updatedUser)
      .set(["users_by_username", user.username], updatedUser)
      .commit();

    // 3. Create default shopping list
    const list = await ShoppingListRepo.create({
      householdId: household.id,
      name: "Shopping List",
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    // 4. Migrate existing items from old key pattern to new
    for await (
      const itemEntry of kv.list<LegacyShoppingListItem>({
        prefix: ["shopping_list", user.id],
      })
    ) {
      const legacy = itemEntry.value;
      const newEntry = await ShoppingListItemRepo.add(list.id, legacy.itemId);
      // Preserve existing quantity, note, checked state
      if (
        legacy.quantity !== 1 || legacy.note || legacy.checked
      ) {
        await ShoppingListItemRepo.update(list.id, newEntry.id, {
          quantity: legacy.quantity,
          note: legacy.note,
          checked: legacy.checked,
        });
      }
      await kv.delete(itemEntry.key);
      migratedItems++;
    }

    migratedUsers++;
    console.log(`  ✅ household: ${household.id}, list: ${list.id}`);
  }

  console.log(
    `\nMigration complete. Users: ${migratedUsers}, items: ${migratedItems}`,
  );
  kv.close();
}

if (import.meta.main) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    Deno.exit(1);
  });
}
