import { define, json } from "@/utils/index.ts";

export const handler = define.handlers({
  GET(ctx) {
    if (!ctx.state.householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    // The public key is public by definition — it ships to the browser as
    // applicationServerKey. Only its absence is interesting.
    if (!publicKey) {
      return new Response("Push not configured", { status: 503 });
    }
    return json({ publicKey });
  },
});
