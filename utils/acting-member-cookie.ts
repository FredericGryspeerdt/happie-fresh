import { deleteCookie, setCookie } from "$std/http/cookie.ts";

export const ACTING_MEMBER_COOKIE_NAME = "actingMemberId";

/** 400 days — the browser maximum. The claim is per-device and should
 *  effectively never expire on its own (Q6: pick once per device). */
const ACTING_MEMBER_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * The single place that knows the acting-member cookie's attributes. Same
 * shape as the session cookie (utils/session-cookie.ts) and for the same
 * reasons: host-only (no Domain — see the LAN-testing note there), HttpOnly
 * (exempts it from Safari ITP's 7-day purge of script-writable storage, which
 * would otherwise make every iOS PWA device re-pick weekly).
 */
export function setActingMemberCookie(
  headers: Headers,
  memberId: string,
): void {
  setCookie(headers, {
    name: ACTING_MEMBER_COOKIE_NAME,
    value: memberId,
    maxAge: ACTING_MEMBER_MAX_AGE,
    sameSite: "Lax",
    path: "/",
    secure: true,
    httpOnly: true,
  });
}

/** Mirror of setActingMemberCookie: same name, Path=/, host-only. */
export function deleteActingMemberCookie(headers: Headers): void {
  deleteCookie(headers, ACTING_MEMBER_COOKIE_NAME, { path: "/" });
}
