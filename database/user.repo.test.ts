import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { UserRepo } from "@/database/user.repo.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import type { UserInterface } from "@/models/index.ts";

Deno.env.set("KV_PATH", ":memory:");

Deno.test({
  name: "create — creates household, manager member, and links memberId",
  sanitizeResources: false,
  async fn() {
    const user = await UserRepo.create({
      username: "robin",
      passwordHash: "x",
    });
    assertEquals(typeof user.memberId, "string");
    const member = await MemberRepo.getById(user.householdId, user.memberId!);
    assertEquals(member?.name, "Robin");
    assertEquals(member?.isManager, true);
  },
});

Deno.test({
  name: "ensureMember — backfills a manager member for a legacy user",
  sanitizeResources: false,
  async fn() {
    // Write a pre-member user record directly, bypassing UserRepo.create.
    const kv = await getKv();
    const legacy: UserInterface = {
      id: "legacy-1",
      username: "alex",
      passwordHash: "x",
      householdId: "hh-legacy",
    };
    await kv.atomic()
      .set(["users", legacy.id], legacy)
      .set(["users_by_username", legacy.username], legacy)
      .commit();

    const linked = await UserRepo.ensureMember(legacy);
    assertEquals(typeof linked.memberId, "string");
    const member = await MemberRepo.getById("hh-legacy", linked.memberId!);
    assertEquals(member?.name, "Alex");
    assertEquals(member?.isManager, true);

    // Idempotent: a second call returns the same link, creates nothing new.
    const again = await UserRepo.ensureMember(linked);
    assertEquals(again.memberId, linked.memberId);
    assertEquals((await MemberRepo.getAll("hh-legacy")).length, 1);
  },
});

Deno.test({
  name: "ensureMember — concurrent calls converge on a single member",
  sanitizeResources: false,
  async fn() {
    const kv = await getKv();
    const legacy: UserInterface = {
      id: "legacy-race",
      username: "casey",
      passwordHash: "x",
      householdId: "hh-race",
    };
    await kv.atomic()
      .set(["users", legacy.id], legacy)
      .set(["users_by_username", legacy.username], legacy)
      .commit();

    // Both calls start from the same stale record, so they interleave at
    // each await and one loses the atomic check — the loser deletes its
    // member and adopts the winner's.
    const [a, b] = await Promise.all([
      UserRepo.ensureMember(legacy),
      UserRepo.ensureMember(legacy),
    ]);

    assertEquals(typeof a.memberId, "string");
    assertEquals(a.memberId, b.memberId);
    assertEquals((await MemberRepo.getAll("hh-race")).length, 1);
  },
});
