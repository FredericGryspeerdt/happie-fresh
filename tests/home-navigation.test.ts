import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handler } from "@/routes/index.tsx";
Deno.test("ordinary app launch opens Start", () => {
  const res = handler.GET({} as Parameters<typeof handler.GET>[0]);
  assertEquals(res.headers.get("location"), "/home");
});
