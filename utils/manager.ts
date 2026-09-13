import { type Context } from "fresh";
import { type StateInterface } from "./define.ts";

/**
 * Manager gate for destructive endpoints (see docs/adr/0006: a guardrail
 * against curious kids, enforced against the *claimed* acting member, not a
 * security boundary). Returns null when the acting member manages the
 * household, otherwise the 403 to return.
 */
export function requireManager(
  ctx: Context<StateInterface>,
): Response | null {
  if (ctx.state.actingMember?.isManager) return null;
  return new Response("Only a household manager can do that", {
    status: 403,
  });
}
