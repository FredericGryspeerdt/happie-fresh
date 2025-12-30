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
    deleteCookie(headers, "sessionId", { path: "/", domain: ctx.url.hostname });
    headers.set("location", "/login");

    return new Response(null, {
      status: 303,
      headers,
    });
  },
};
