import { Context } from "fresh";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "@/database/session.repo.ts";

interface State {
  userId?: string;
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
      ctx.state.userId = session.userId;
      return await ctx.next();
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
