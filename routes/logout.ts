import { Handlers } from "fresh/compat";
import { deleteCookie, getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "../database/session.repo.ts";

export const handler: Handlers = {
  async GET(ctx) {
    const cookies = getCookies(ctx.req.headers);
    const sessionId = cookies.sessionId;

    if (sessionId) {
      await SessionRepo.delete(sessionId);
    }

    const headers = new Headers();
    // Must mirror the attributes used in utils/session-cookie.ts — a
    // host-only cookie is only cleared by a host-only delete, so no
    // `domain` here either.
    deleteCookie(headers, "sessionId", { path: "/" });
    headers.set("location", "/login");

    return new Response(null, {
      status: 303,
      headers,
    });
  },
};
