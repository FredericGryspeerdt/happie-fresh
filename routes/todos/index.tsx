import { page } from "fresh";
import { MemberRepo, TodoRepo } from "@/database/index.ts";
import TodoBacklog from "@/islands/todos/TodoBacklog.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const [todos, members] = await Promise.all([
      TodoRepo.getAll(householdId),
      MemberRepo.getAll(householdId),
    ]);
    return page({
      todos,
      members,
      actingMemberId: ctx.state.actingMember?.id ?? null,
      canDelete: ctx.state.actingMember?.isManager === true,
    });
  },
});

export default define.page<typeof handler>(function Todos({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <TodoBacklog
        initialTodos={data.todos}
        members={data.members}
        actingMemberId={data.actingMemberId}
        canDelete={data.canDelete}
      />
    </main>
  );
});
