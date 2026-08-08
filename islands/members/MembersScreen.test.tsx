import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import MembersScreen from "./MembersScreen.tsx";
import type { MemberInterface } from "@/models/index.ts";

function member(over: Partial<MemberInterface>): MemberInterface {
  return {
    id: "m1",
    householdId: "hh",
    name: "Demo",
    color: "sky",
    emoji: "🙂",
    isManager: false,
    ...over,
  };
}

Deno.test("MembersScreen — a manager sees member names, the Manager label, and Add a member", () => {
  const demo = member({ id: "m1", name: "Demo", isManager: true });
  const robin = member({ id: "m2", name: "Robin", isManager: false });
  const html = render(h(MembersScreen, {
    initialMembers: [demo, robin],
    actingMember: demo,
  }));

  assertStringIncludes(html, "Demo");
  assertStringIncludes(html, "Robin");
  assertStringIncludes(html, "Manager");
  assertStringIncludes(html, "Add a member");
});

Deno.test("MembersScreen — a non-manager does not see Add a member", () => {
  const demo = member({ id: "m1", name: "Demo", isManager: true });
  const robin = member({ id: "m2", name: "Robin", isManager: false });
  const html = render(h(MembersScreen, {
    initialMembers: [demo, robin],
    actingMember: robin,
  }));

  assertStringIncludes(html, "Demo");
  assertStringIncludes(html, "Robin");
  assertFalse(html.includes("Add a member"));
});
