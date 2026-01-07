import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  GET(_ctx) {
    const headers = new Headers();
    headers.set("location", "/home");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
});
