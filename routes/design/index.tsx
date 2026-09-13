import { HttpError, page } from "fresh";
import { define } from "@/utils/index.ts";
import DesignShowcase from "@/islands/design/DesignShowcase.tsx";

export const handler = define.handlers({
  GET() {
    // Dev-only: DENO_DEPLOYMENT_ID is set on Deno Deploy (prod + previews).
    if (Deno.env.get("DENO_DEPLOYMENT_ID")) throw new HttpError(404);
    return page({});
  },
});

export default define.page<typeof handler>(function Design() {
  return (
    <main class="max-w-md mx-auto px-4">
      <DesignShowcase />
    </main>
  );
});
