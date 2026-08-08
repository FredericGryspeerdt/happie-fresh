import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  deleteActingMemberCookie,
  setActingMemberCookie,
} from "@/utils/acting-member-cookie.ts";

Deno.test("setActingMemberCookie — long-lived, HttpOnly, host-only, Path=/", () => {
  const headers = new Headers();
  setActingMemberCookie(headers, "m-123");
  const cookie = headers.get("set-cookie")!;
  assertEquals(cookie.includes("actingMemberId=m-123"), true);
  assertEquals(cookie.includes("HttpOnly"), true);
  assertEquals(cookie.includes("Secure"), true);
  assertEquals(cookie.includes("Path=/"), true);
  assertEquals(cookie.includes("Max-Age=34560000"), true);
  assertEquals(cookie.includes("Domain="), false); // host-only, like the session cookie
});

Deno.test("deleteActingMemberCookie — clears with matching name and path", () => {
  const headers = new Headers();
  deleteActingMemberCookie(headers);
  const cookie = headers.get("set-cookie")!;
  assertEquals(cookie.includes("actingMemberId="), true);
  assertEquals(cookie.includes("Path=/"), true);
});
