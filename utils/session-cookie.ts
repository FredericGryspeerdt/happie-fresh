import { deleteCookie, setCookie } from "$std/http/cookie.ts";

export const SESSION_COOKIE_NAME = "sessionId";

/**
 * The single place that knows the session cookie's attributes. Login, logout,
 * and the auth middleware all go through here.
 */
export function setSessionCookie(
  headers: Headers,
  sessionId: string,
  maxAgeSeconds: number,
): void {
  setCookie(headers, {
    name: SESSION_COOKIE_NAME,
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

/**
 * Browsers only clear a cookie when the delete's name, path, and domain
 * scope match the original — so this must stay the mirror of
 * setSessionCookie: same name, `Path=/`, and host-only (no `domain`).
 */
export function deleteSessionCookie(headers: Headers): void {
  deleteCookie(headers, SESSION_COOKIE_NAME, { path: "/" });
}
