import { define } from "@/utils/index.ts";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";

export default define.page(function Home() {
  return (
    <main class="max-w-md mx-auto">
      <ComingSoon
        icon="home"
        title="Start"
        blurb="Het overzicht voor je huishouden komt eraan. Ga intussen naar Boodschappen."
      />
    </main>
  );
});
