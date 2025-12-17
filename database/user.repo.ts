import { UserInterface } from "../models/index.ts";
import { getKv } from "./db.ts";

export class UserRepo {
  static async findByUsername(username: string): Promise<UserInterface | null> {
    const kv = await getKv();
    const user = await kv.get<UserInterface>(["users", username]);
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
}
