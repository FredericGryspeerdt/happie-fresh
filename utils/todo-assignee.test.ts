import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { MemberRepo } from "@/database/member.repo.ts";
import { getKv } from "@/database/db.ts";
import { resolveAssignee } from "@/utils/todo-assignee.ts";

Deno.env.set("KV_PATH", ":memory:");

async function clearMembers() {
  const kv = await getKv();
  for await (const entry of kv.list({ prefix: ["members"] })) {
    await kv.delete(entry.key);
  }
}

Deno.test({
  name: "resolveAssignee accepts nullish values and household members",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const member = await MemberRepo.create({
      householdId: "h1",
      name: "Bo",
      color: "meadow",
      emoji: "🐸",
      isManager: false,
    });

    assertEquals(await resolveAssignee("h1", undefined), null);
    assertEquals(await resolveAssignee("h1", null), null);
    assertEquals(await resolveAssignee("h1", member.id), member.id);
  },
});

Deno.test({
  name: "resolveAssignee rejects malformed and other-household member ids",
  sanitizeResources: false,
  async fn() {
    await clearMembers();
    const stranger = await MemberRepo.create({
      householdId: "h2",
      name: "Sam",
      color: "sky",
      emoji: "⭐",
      isManager: false,
    });

    assertEquals(await resolveAssignee("h1", 42), undefined);
    assertEquals(await resolveAssignee("h1", stranger.id), undefined);
  },
});
