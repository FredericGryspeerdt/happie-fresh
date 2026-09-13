import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { stub } from "jsr:@std/testing@^1.0.18/mock";
import { api } from "@/services/api.ts";
import { useMembers } from "@/hooks/useMembers.ts";
import type { MemberInterface } from "@/models/index.ts";

const member = (
  id: string,
  name: string,
  isManager = false,
): MemberInterface => ({
  id,
  householdId: "h1",
  name,
  color: "sky",
  emoji: "🙂",
  isManager,
});

Deno.test("addMember — pessimistic: appends only the server-returned member, sorted", async () => {
  const created = member("new", "Bo");
  const create = stub(api.members, "create", () => Promise.resolve(created));
  const hook = useMembers([member("1", "Robin")]);
  try {
    const result = await hook.addMember({
      name: "Bo",
      color: "sky",
      emoji: "🙂",
    });
    assertEquals(result, created);
    assertEquals(hook.members.value.map((m) => m.name), ["Bo", "Robin"]);
  } finally {
    create.restore();
  }
});

Deno.test("addMember — on failure returns null and adds nothing", async () => {
  const create = stub(api.members, "create", () => Promise.resolve(null));
  const hook = useMembers([member("1", "Robin")]);
  try {
    assertEquals(
      await hook.addMember({ name: "Bo", color: "sky", emoji: "🙂" }),
      null,
    );
    assertEquals(hook.members.value.length, 1);
  } finally {
    create.restore();
  }
});

Deno.test("updateMember — optimistic, rolls back when the server rejects", async () => {
  const update = stub(api.members, "update", () => Promise.resolve(null));
  const hook = useMembers([member("1", "Robin", true)]);
  try {
    const saved = await hook.updateMember("1", { isManager: false });
    assertEquals(saved, null);
    assertEquals(hook.members.value[0].isManager, true); // rolled back
  } finally {
    update.restore();
  }
});

Deno.test("removeMember — optimistic, rolls back on failure", async () => {
  const remove = stub(api.members, "remove", () => Promise.resolve(false));
  const hook = useMembers([member("1", "Robin"), member("2", "Bo")]);
  try {
    const ok = await hook.removeMember("2");
    assertEquals(ok, false);
    assertEquals(hook.members.value.length, 2); // rolled back
  } finally {
    remove.restore();
  }
});
