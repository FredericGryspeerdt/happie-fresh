import { UserInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { HouseholdRepo } from "./household.repo.ts";
import { ShoppingListRepo } from "./shopping-list.repo.ts";

export class UserRepo {
  static async findByUsername(username: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users_by_username", username]);
    return user.value;
  }

  static async findById(id: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users", id]);
    return user.value;
  }

  static async create(
    user: Omit<UserInterface, "id" | "householdId">,
  ): Promise<UserInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const household = await HouseholdRepo.create(`${user.username}'s household`);
    const userWithId: UserInterface = { ...user, id, householdId: household.id };
    await kv
      .atomic()
      .set(["users", userWithId.id], userWithId)
      .set(["users_by_username", user.username], userWithId)
      .commit();
    await ShoppingListRepo.create({
      householdId: household.id,
      name: "Shopping List",
      createdBy: id,
      createdAt: new Date().toISOString(),
    });
    return userWithId;
  }

  static async deleteAll(): Promise<void> {
    const kv = await getKv();
    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      await kv
        .atomic()
        .delete(["users", user.id])
        .delete(["users_by_username", user.username])
        .commit();
    }
  }
}
