import webpush from "web-push";
import type { PushSubscriptionInterface } from "@/models/index.ts";
import { PushSubscriptionRepo } from "@/database/push-subscription.repo.ts";

export interface PushPayload {
  title: string;
  body: string;
  /** Per-to-do (`todo-<id>`) so notifications stay separate but a re-send replaces. */
  tag: string;
  /** Where notificationclick should take the member. */
  url: string;
}

/**
 * The single path to the push service. Both the cron sweep and the
 * test-notification endpoint go through here, differing only in payload — a
 * separate test path would exercise code nobody uses in anger and produce false
 * confidence.
 */

function vapid() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

/**
 * Sends one notification to every device in a household.
 *
 * `subs` lets the sweep read a household's subscriptions once per run and pass
 * them in, rather than re-reading for each of several to-dos sharing an instant
 * (which the 09:00 create-sheet default makes the common case).
 */
export async function sendToHousehold(
  householdId: string,
  payload: PushPayload,
  subs?: PushSubscriptionInterface[],
): Promise<{ sent: number; failed: number }> {
  const config = vapid();
  if (!config) {
    // Deliberately not an error: without this the cron tick would throw every
    // five minutes on a deployment where push simply isn't configured yet.
    console.warn("[push] VAPID env not set — skipping send");
    return { sent: 0, failed: 0 };
  }
  try {
    webpush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
  } catch (err) {
    // A malformed key fails exactly like an absent one, and must be just as
    // survivable: letting this throw would error every five-minute cron tick,
    // and the sweep has already claimed the fire-point by the time we get here.
    console.error("[push] VAPID env is set but invalid — skipping send", err);
    return { sent: 0, failed: 0 };
  }

  const targets = subs ?? await PushSubscriptionRepo.getAll(householdId);
  let sent = 0;
  let failed = 0;

  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The push service says this endpoint is dead. Left in place, every run
        // would keep paying for it forever.
        await PushSubscriptionRepo.delete(householdId, sub.id);
        console.info(`[push] removed dead subscription ${sub.id}`);
      } else {
        console.error(`[push] send failed (${status ?? "no status"})`, err);
      }
    }
  }

  return { sent, failed };
}
