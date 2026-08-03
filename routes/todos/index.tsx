import { page } from "fresh";
import { TodoRepo } from "@/database/index.ts";
import TodoBacklog from "@/islands/todos/TodoBacklog.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    return page({ todos: await TodoRepo.getAll(householdId) });
  },
});

export default define.page<typeof handler>(function Todos({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <TodoBacklog initialTodos={data.todos} />
    </main>
  );
});
