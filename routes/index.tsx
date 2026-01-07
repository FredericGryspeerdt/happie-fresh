import { rootPage } from "@/utils/index.ts";

export const handler = rootPage.handlers({
  GET() {
    const headers = new Headers();
    headers.set("location", "/home");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
});
