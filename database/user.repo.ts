import { UserInterface } from "../models/index.ts";
import { getKv } from "./db.ts";
import { HouseholdRepo } from "./household.repo.ts";
import { ShoppingListRepo } from "./shopping-list.repo.ts";
import { MemberRepo } from "./member.repo.ts";
import { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_EMOJI } from "@/models/index.ts";

/** "robin" → "Robin": the migrated member's starting name, editable later. */
function displayNameFromUsername(username: string): string {
  return username.charAt(0).toUpperCase() + username.slice(1);
}

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
    user: Omit<UserInterface, "id" | "householdId" | "memberId">,
  ): Promise<UserInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const household = await HouseholdRepo.create(
      `${user.username}'s household`,
    );
    const member = await MemberRepo.create({
      householdId: household.id,
      name: displayNameFromUsername(user.username),
      color: DEFAULT_AVATAR_COLOR,
      emoji: DEFAULT_AVATAR_EMOJI,
      isManager: true,
    });
    const userWithId: UserInterface = {
      ...user,
      id,
      householdId: household.id,
      memberId: member.id,
    };
    await kv
      .atomic()
      .set(["users", userWithId.id], userWithId)
      .set(["users_by_username", user.username], userWithId)
      .commit();
    await ShoppingListRepo.create({
      householdId: household.id,
      name: "Shopping List",
      createdBy: member.id,
      createdAt: new Date().toISOString(),
    });
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
    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      await kv
        .atomic()
        .delete(["users", user.id])
        .delete(["users_by_username", user.username])
        .commit();
    }
  }

  /**
   * Backfills the user→member link for records created before members
   * existed, and re-heals a login whose linked member was removed (e.g. a
   * manager deletes the login's own member) — the two cases are deliberately
   * the same path: both leave the user without a member that actually
   * resolves. Called lazily from the auth middleware (sessions outlive
   * deploys, so a login-time hook would miss everyone already signed in) and
   * from the data migration. Concurrency-safe: the atomic check makes the
   * loser of a race discard its member and adopt the winner's.
   */
  static async ensureMember(user: UserInterface): Promise<UserInterface> {
    const kv = await getKv();
    const entry = await kv.get<UserInterface>(["users", user.id]);
    if (!entry.value) return user;
    if (entry.value.memberId) {
      const member = await MemberRepo.getById(
        entry.value.householdId,
        entry.value.memberId,
      );
      if (member) return entry.value;
    }

    const member = await MemberRepo.create({
      householdId: entry.value.householdId,
      name: displayNameFromUsername(entry.value.username),
      color: DEFAULT_AVATAR_COLOR,
      emoji: DEFAULT_AVATAR_EMOJI,
      isManager: true,
    });
    const updated: UserInterface = { ...entry.value, memberId: member.id };
    const res = await kv
      .atomic()
      .check(entry)
      .set(["users", user.id], updated)
      .set(["users_by_username", updated.username], updated)
      .commit();
    if (!res.ok) {
      // Lost a race with a concurrent ensureMember — the winner's member stands.
      await MemberRepo.delete(entry.value.householdId, member.id);
      return (await this.findById(user.id)) ?? user;
    }
    return updated;
  }
}
