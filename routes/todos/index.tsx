import { define } from "@/utils/index.ts";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";

export default define.page(function Todos() {
  return (
    <main class="max-w-md mx-auto">
      <ComingSoon
        icon="checklist"
        title="To-dos"
        blurb="Shared to-dos are coming soon — a place for the whole household's tasks."
      />
    </main>
  );
});
