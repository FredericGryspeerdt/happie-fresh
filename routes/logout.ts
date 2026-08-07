import { Handlers } from "fresh/compat";
import { getCookies } from "$std/http/cookie.ts";
import { SessionRepo } from "../database/session.repo.ts";
import { deleteSessionCookie, SESSION_COOKIE_NAME } from "@/utils/index.ts";

export const handler: Handlers = {
  async GET(ctx) {
    const cookies = getCookies(ctx.req.headers);
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (sessionId) {
      await SessionRepo.delete(sessionId);
    }

    const headers = new Headers();
    deleteSessionCookie(headers);
    headers.set("location", "/login");

    return new Response(null, {
      status: 303,
      headers,
    });
  },
};
