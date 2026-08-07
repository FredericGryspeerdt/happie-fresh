import { setCookie } from "$std/http/cookie.ts";

/**
 * The single place that knows the session cookie's attributes. Login and
 * the auth middleware both go through here; routes/logout.ts must keep its
 * deleteCookie attributes in sync with these.
 */
export function setSessionCookie(
  headers: Headers,
  sessionId: string,
  maxAgeSeconds: number,
): void {
  setCookie(headers, {
    name: "sessionId",
    value: sessionId,
    maxAge: maxAgeSeconds,
    sameSite: "Lax",
    // No `domain`: a host-only cookie is scoped to whatever host served it,
    // which is what we want. Pinning it to `ctx.url.hostname` broke on-device
    // testing — behind the Fresh Vite plugin the inner request URL is always
    // localhost, so a phone hitting the LAN address got `Domain=localhost`
    // and the browser silently rejected the cookie (endless login loop).
    path: "/",
    secure: true,
    // HttpOnly keeps XSS away from the session ID, and exempts the cookie
    // from Safari ITP's 7-day purge of script-writable storage (matters for
    // the iOS PWA).
    httpOnly: true,
  });
}
