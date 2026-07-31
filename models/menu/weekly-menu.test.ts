import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { WEEKDAY_ORDER } from "@/models/index.ts";

Deno.test("WEEKDAY_ORDER — Monday-first, seven days", () => {
  assertEquals(WEEKDAY_ORDER, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});
