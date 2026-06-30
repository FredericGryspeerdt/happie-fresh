import { define } from "@/utils/index.ts";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";

export default define.page(function MenuPlanner() {
  return (
    <main class="max-w-md mx-auto">
      <ComingSoon
        icon="plate"
        title="Menu planner"
        blurb="Plan the week's meals together, then turn them into a shopping list in one tap. This module is on the way."
      />
    </main>
  );
});
