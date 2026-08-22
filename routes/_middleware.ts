import { Context } from "fresh";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { MemberRepo } from "@/database/member.repo.ts";
import {
  ACTING_MEMBER_COOKIE_NAME,
  deleteSessionCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/utils/index.ts";
import { type StateInterface } from "@/utils/define.ts";

export async function handler(
  ctx: Context<StateInterface>,
) {
  const req = ctx.req;
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. Public Allowlist
  if (
    path === "/login" ||
    path.startsWith("/_fresh") ||
    path.startsWith("/static") ||
    path.startsWith("/assets") ||
    path.startsWith("/favicon.ico")
  ) {
    return await ctx.next();
  }

  // 2. Session Check
  const cookies = getCookies(req.headers);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  if (sessionId) {
    const session = await SessionRepo.findById(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      let user = await UserRepo.findById(session.userId);
      ctx.state.userId = session.userId;
      ctx.state.householdId = user?.householdId;

      if (user?.householdId) {
        // The device's claimed member, when the claim still resolves. A cookie
        // pointing at a removed member is treated as no claim: the chip island
        // re-opens the picker (graceful dangle, never a crash).
        const claimedId = cookies[ACTING_MEMBER_COOKIE_NAME];
        const claimed = claimedId
          ? await MemberRepo.getById(user.householdId, claimedId)
          : null;
        ctx.state.actingClaimed = claimed !== null;

        let acting = claimed;
        if (!acting && user.memberId) {
          acting = await MemberRepo.getById(user.householdId, user.memberId);
        }
        if (!acting) {
          // Legacy user (no member link) or a dangling link (the household
          // removed the login's own member): heal both the same way, lazily —
          // sessions outlive deploys, so a login-time hook would miss everyone
          // already signed in.
          user = await UserRepo.ensureMember(user);
          if (user.memberId) {
            acting = await MemberRepo.getById(user.householdId, user.memberId);
          }
        }
        ctx.state.actingMember = acting ?? undefined;
      }

      const response = await ctx.next();

      try {
        const renewed = await SessionRepo.touch(session);
        if (renewed) {
          const maxAge = Math.floor(
            (new Date(renewed.expiresAt).getTime() - Date.now()) / 1000,
          );
          setSessionCookie(response.headers, renewed.id, maxAge);
        }
      } catch {
        // Renewal is best-effort — the session stays valid until its
        // current expiresAt, so never fail the request over it.
      }

      return response;
    }
  }

  // 3. Unauthorized Handling
  if (path.startsWith("/api")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Redirect to login for page requests
  const headers = new Headers();
  if (sessionId) {
    // The cookie pointed at a dead session (expired, or dropped by e.g. a
    // reseed). Clear it, or it causes a KV miss on every request for up to
    // the cookie's 30-day lifetime.
    deleteSessionCookie(headers);
  }
  headers.set("location", "/login");
  return new Response(null, {
    status: 303,
    headers,
  });
}
