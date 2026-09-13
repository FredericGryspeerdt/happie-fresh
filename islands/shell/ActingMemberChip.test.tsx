import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import ActingMemberChip from "./ActingMemberChip.tsx";
import type { MemberInterface } from "@/models/index.ts";

const bo: MemberInterface = {
  id: "member-bo",
  householdId: "household-1",
  name: "Bo",
  color: "green",
  emoji: "🐸",
  isManager: false,
};

Deno.test("ActingMemberChip — shows the acting member's avatar and switch label", () => {
  const html = render(
    h(ActingMemberChip, { actingMember: bo, claimed: true }),
  );
  assertStringIncludes(html, "🐸");
  assertStringIncludes(html, 'aria-label="Switch member"');
});

Deno.test("ActingMemberChip — falls back to the people icon when no acting member", () => {
  const html = render(
    h(ActingMemberChip, { actingMember: null, claimed: true }),
  );
  assertStringIncludes(html, 'aria-label="Switch member"');
});
