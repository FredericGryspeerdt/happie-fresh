import { define } from "@/utils/index.ts";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";

export default define.page(function Home() {
  return (
    <main class="max-w-md mx-auto">
      <ComingSoon
        icon="home"
        title="Home"
        blurb="Your family dashboard is on the way. For now, jump into Shopping."
      />
    </main>
  );
});
