import { Context } from "fresh";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "@/database/session.repo.ts";
import { UserRepo } from "@/database/user.repo.ts";
import { devAutoLoginUsername } from "@/utils/index.ts";

interface State {
  userId?: string;
  householdId?: string;
}

function seeOther(location: string): Response {
  const headers = new Headers();
  headers.set("location", location);
  return new Response(null, { status: 303, headers });
}

export async function handler(
  ctx: Context<State>,
) {
  const req = ctx.req;
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. Static assets — always public.
  if (
    path.startsWith("/_fresh") ||
    path.startsWith("/static") ||
    path.startsWith("/assets") ||
    path.startsWith("/favicon.ico")
  ) {
    return await ctx.next();
  }

  // 2. Dev auto-login. Never active in production — DENO_DEPLOYMENT_ID is always
  //    set on Deno Deploy. When enabled and the seeded user exists, act as that
  //    user without a session and skip the login page entirely.
  const devUsername = devAutoLoginUsername(
    Deno.env.get("DENO_DEPLOYMENT_ID"),
    Deno.env.get("DEV_AUTOLOGIN"),
    Deno.env.get("SEED_USERNAME"),
  );
  if (devUsername) {
    const devUser = await UserRepo.findByUsername(devUsername);
    if (devUser) {
      if (path === "/login") return seeOther("/shopping");
      ctx.state.userId = devUser.id;
      ctx.state.householdId = devUser.householdId;
      return await ctx.next();
    }
    // Dev user not seeded yet — fall through to the normal login flow.
  }

  // 3. Login page is public.
  if (path === "/login") {
    return await ctx.next();
  }

  // 4. Session check.
  const cookies = getCookies(req.headers);
  const sessionId = cookies.sessionId;

  if (sessionId) {
    const session = await SessionRepo.findById(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      const user = await UserRepo.findById(session.userId);
      ctx.state.userId = session.userId;
      ctx.state.householdId = user?.householdId;
      return await ctx.next();
    }
  }

  // 5. Unauthorized handling.
  if (path.startsWith("/api")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Redirect to login for page requests.
  return seeOther("/login");
}
