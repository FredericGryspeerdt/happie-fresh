import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { MemberRepo } from "@/database/member.repo.ts";
import type { CreateMemberDto } from "@/models/index.ts";

// Isolated in-memory KV for this test process (see todo.repo.test.ts for why
// module-load is early enough and why sanitizeResources is disabled).
Deno.env.set("KV_PATH", ":memory:");

function draft(
  householdId: string,
  name: string,
  overrides: Partial<CreateMemberDto> = {},
): CreateMemberDto {
  return {
    householdId,
    name,
    color: "sky",
    emoji: "🙂",
    isManager: false,
    ...overrides,
  };
}

Deno.test({
  name: "create — mints an id and stores the member",
  sanitizeResources: false,
  async fn() {
    const member = await MemberRepo.create(draft("hh-create", "Bo"));
    assertEquals(member.name, "Bo");
    assertEquals(typeof member.id, "string");
    assertEquals(member.id.length > 0, true);
    const found = await MemberRepo.getById("hh-create", member.id);
    assertEquals(found?.id, member.id);
  },
});

Deno.test({
  name: "getAll — scoped to the household, sorted by name",
  sanitizeResources: false,
  async fn() {
    await MemberRepo.create(draft("hh-all", "Robin"));
    await MemberRepo.create(draft("hh-all", "Alex"));
    await MemberRepo.create(draft("hh-other", "Sam"));
    const members = await MemberRepo.getAll("hh-all");
    assertEquals(members.map((m) => m.name), ["Alex", "Robin"]);
  },
});

Deno.test({
  name: "update — merges defined fields only",
  sanitizeResources: false,
  async fn() {
    const m = await MemberRepo.create(draft("hh-upd", "Bo"));
    const updated = await MemberRepo.update("hh-upd", m.id, { emoji: "🐸" });
    assertEquals(updated?.emoji, "🐸");
    assertEquals(updated?.name, "Bo");
    assertEquals(
      await MemberRepo.update("hh-upd", "nope", { name: "X" }),
      null,
    );
  },
});

Deno.test({
  name: "delete — removes the member",
  sanitizeResources: false,
  async fn() {
    const m = await MemberRepo.create(draft("hh-del", "Bo"));
    await MemberRepo.delete("hh-del", m.id);
    assertEquals(await MemberRepo.getById("hh-del", m.id), null);
  },
});

Deno.test({
  name: "countManagers — counts only managers in the household",
  sanitizeResources: false,
  async fn() {
    await MemberRepo.create(draft("hh-count", "Alex", { isManager: true }));
    await MemberRepo.create(draft("hh-count", "Robin", { isManager: true }));
    await MemberRepo.create(draft("hh-count", "Bo"));
    await MemberRepo.create(draft("hh-elsewhere", "Sam", { isManager: true }));
    assertEquals(await MemberRepo.countManagers("hh-count"), 2);
  },
});
