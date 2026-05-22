import { UserInterface } from "../models/index.ts";
import { getKv } from "./db.ts";

export class UserRepo {
  static async findByUsername(username: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users_by_username", username]);
    return user.value;
  }

  static async create(user: Omit<UserInterface, "id">): Promise<UserInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const userWithId = { ...user, id };
    await kv
      .atomic()
      .set(["users", userWithId.id], userWithId)
      .set(["users_by_username", user.username], userWithId)
      .commit();
    return userWithId;
  }

  static async updatePasswordHash(
    userId: string,
    newHash: string,
  ): Promise<void> {
    const kv = await getKv();
    const entry = await kv.get<UserInterface>(["users", userId]);
    if (!entry.value) {
      throw new Error(`User not found: ${userId}`);
    }
    const updated = { ...entry.value, passwordHash: newHash };
    await kv
      .atomic()
      .set(["users", userId], updated)
      .set(["users_by_username", entry.value.username], updated)
      .commit();
  }

  static async deleteAll(): Promise<void> {
    const kv = await getKv();
    // WARNING: This will delete all users. Use with caution.
    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      console.log("🚀 ~ UserRepo ~ deleteAll ~ user:", user);
      await kv
        .atomic()
        .delete(["users", user.id])
        .delete(["users_by_username", user.username])
        .commit();
    }
  }
}
