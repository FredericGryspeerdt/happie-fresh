import { getKv } from "@/database/db.ts";
import { HouseholdRepo } from "@/database/household.repo.ts";
import { CategoryRepo } from "@/database/category.repo.ts";
import { ItemRepo } from "@/database/item.repo.ts";
import { ShoppingListRepo } from "@/database/shopping-list.repo.ts";
import { ShoppingListItemRepo } from "@/database/shopping-list-item.repo.ts";
import { hashPassword } from "@/utils/index.ts";
import { UserInterface } from "@/models/index.ts";
import { catalogue, categories, users } from "./fixtures.ts";

/** KV collections owned and rebuilt by the dev seed. */
const SEED_PREFIXES: Deno.KvKey[] = [
  ["users"],
  ["users_by_username"],
  ["households"],
  ["categories"],
  ["items"],
  ["shopping_lists"],
  ["shopping_list_items"],
  ["sessions"],
];

/** True on Deno Deploy (production), where seeding must never run. */
export function isProductionEnv(deploymentId: string | undefined): boolean {
  return !!deploymentId;
}

/** True when KV_PATH targets a remote (https) database, where seeding must never run. */
export function isRemoteKvPath(kvPath: string | undefined): boolean {
  return !!kvPath && kvPath.startsWith("https://");
}

/** Deletes every entry under the seed-owned prefixes. */
export async function resetDatabase(): Promise<void> {
  const kv = await getKv();
  for (const prefix of SEED_PREFIXES) {
    for await (const entry of kv.list({ prefix })) {
      await kv.delete(entry.key);
    }
  }
}

export interface SeedOptions {
  primaryUsername?: string;
  primaryPassword?: string;
}

/**
 * Wipes the seed-owned collections and rebuilds them from the fixtures.
 * The first fixture user is the "primary" account; `opts` overrides its
 * credentials (supplied from SEED_USERNAME/SEED_PASSWORD by the entrypoint).
 */
export async function runSeed(opts: SeedOptions = {}): Promise<void> {
  if (
    opts.primaryUsername &&
    users.slice(1).some((u) => u.username === opts.primaryUsername)
  ) {
    throw new Error(
      `SEED_USERNAME '${opts.primaryUsername}' collides with a fixture username; choose a different value.`,
    );
  }

  const kv = await getKv();
  await resetDatabase();

  // 1. Users + households. Bypass UserRepo.create (it force-creates an empty
  //    "Shopping List") and write the same records it would, so fixture lists
  //    are the only lists.
  const userIdBySlug = new Map<string, string>();
  const householdIdBySlug = new Map<string, string>();
  let primaryUserId = "";
  for (let i = 0; i < users.length; i++) {
    const fixtureUser = users[i];
    const username = i === 0
      ? opts.primaryUsername || fixtureUser.username
      : fixtureUser.username;
    const password = i === 0
      ? opts.primaryPassword || fixtureUser.password
      : fixtureUser.password;

    const household = await HouseholdRepo.create(`${username}'s household`);
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const record: UserInterface = {
      id,
      username,
      passwordHash,
      householdId: household.id,
    };
    await kv
      .atomic()
      .set(["users", id], record)
      .set(["users_by_username", username], record)
      .commit();

    // Key maps by the fixture username so the list phase can look users up
    // regardless of any primary-credential override.
    userIdBySlug.set(fixtureUser.username, id);
    householdIdBySlug.set(fixtureUser.username, household.id);
    if (i === 0) primaryUserId = id;
  }

  // 2. Categories (creator = primary user). Insert in `order` so the repo's
  //    append-at-end ordering reproduces the fixture order.
  const categoryIdBySlug = new Map<string, string>();
  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
  for (const category of orderedCategories) {
    const created = await CategoryRepo.create(category.label, primaryUserId);
    categoryIdBySlug.set(category.slug, created.id);
  }

  // 3. Catalogue items (resolve categoryId; undefined => uncategorized).
  const itemIdBySlug = new Map<string, string>();
  for (const item of catalogue) {
    const categoryId = item.categorySlug
      ? categoryIdBySlug.get(item.categorySlug)
      : undefined;
    const created = await ItemRepo.create({ name: item.name, categoryId });
    itemIdBySlug.set(item.slug, created.id);
  }

  // 4. Shopping lists + list items.
  for (const fixtureUser of users) {
    const userId = userIdBySlug.get(fixtureUser.username)!;
    const householdId = householdIdBySlug.get(fixtureUser.username)!;
    for (const fixtureList of fixtureUser.lists) {
      const list = await ShoppingListRepo.create({
        householdId,
        name: fixtureList.name,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });
      for (const li of fixtureList.items) {
        const itemId = itemIdBySlug.get(li.itemSlug);
        if (!itemId) {
          throw new Error(`Unknown itemSlug in fixtures: ${li.itemSlug}`);
        }
        const entry = await ShoppingListItemRepo.add(list.id, itemId);
        await ShoppingListItemRepo.update(list.id, entry.id, {
          quantity: li.quantity,
          note: li.note,
          checked: li.checked,
        });
      }
    }
  }
}
