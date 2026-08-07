import { Context } from "fresh";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { setSessionCookie } from "@/utils/index.ts";

interface State {
  userId?: string;
  householdId?: string;
}

export async function handler(
  ctx: Context<State>,
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
  const sessionId = cookies.sessionId;

  if (sessionId) {
    const session = await SessionRepo.findById(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      const user = await UserRepo.findById(session.userId);
      ctx.state.userId = session.userId;
      ctx.state.householdId = user?.householdId;

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
  headers.set("location", "/login");
  return new Response(null, {
    status: 303,
    headers,
  });
}
