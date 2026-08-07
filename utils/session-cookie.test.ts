import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.19";
import { setSessionCookie } from "@/utils/session-cookie.ts";

Deno.test("setSessionCookie — sets a secure, HttpOnly, host-only cookie", () => {
  const headers = new Headers();
  setSessionCookie(headers, "abc-123", 2_592_000);

  const cookie = headers.get("set-cookie")!;
  assertMatch(cookie, /^sessionId=abc-123;/);
  assertMatch(cookie, /Max-Age=2592000/i);
  assertMatch(cookie, /HttpOnly/i);
  assertMatch(cookie, /Secure/i);
  assertMatch(cookie, /SameSite=Lax/i);
  assertMatch(cookie, /Path=\//i);
  // Host-only: no Domain attribute (see the comment in the helper).
  assertEquals(/Domain=/i.test(cookie), false);
});
