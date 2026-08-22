import { page } from "fresh";
import { MemberRepo } from "@/database/index.ts";
import MembersScreen from "@/islands/members/MembersScreen.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    ctx.state.appBar = { mode: "detail", title: "Members", backUrl: "/home" };
    const members = await MemberRepo.getAll(ctx.state.householdId!);
    return page({ members, actingMember: ctx.state.actingMember ?? null });
  },
});

export default define.page<typeof handler>(function MembersPage({ data }) {
  return (
    <main class="max-w-md mx-auto px-4">
      <MembersScreen
        initialMembers={data.members}
        actingMember={data.actingMember}
      />
    </main>
  );
});
