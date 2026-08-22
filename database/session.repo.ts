import { getKv } from "./db.ts";
import { SessionInterface } from "@/models/index.ts";

// Sliding idle window: a session dies after this long without activity.
export const SESSION_IDLE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
// Hard ceiling from login, regardless of activity.
const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
// Skip the KV write unless the expiry would move by more than this.
const RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 1 day

export class SessionRepo {
  static async create(userId: string): Promise<SessionInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: SessionInterface = {
      id,
      userId,
      expiresAt: new Date(now + SESSION_IDLE_TTL_MS),
      absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_TTL_MS),
    };

    await kv.set(["sessions", id], session, {
      expireIn: SESSION_IDLE_TTL_MS,
    });
    return session;
  }

  /**
   * Slide the session's expiry to now + 30d (capped at absoluteExpiresAt).
   * Returns the renewed session, or null when nothing was written: the
   * expiry would move by less than a day (throttle — at most one write per
   * session per day), the session predates sliding expiry, or the session
   * was deleted (e.g. logout) concurrently with this call.
   *
   * The cheap pre-check below runs against the caller's (possibly
   * slightly-stale) `session` snapshot to keep the ~99% throttled path free
   * of any KV round-trip. Only when it says "renew" do we re-read from KV
   * and commit via a compare-and-set, so a session deleted between the
   * pre-check and the write can never be resurrected.
   */
  static async touch(
    session: SessionInterface,
  ): Promise<SessionInterface | null> {
    if (!session.absoluteExpiresAt) return null;

    const now = Date.now();
    const newExpiry = Math.min(
      now + SESSION_IDLE_TTL_MS,
      new Date(session.absoluteExpiresAt).getTime(),
    );
    const gained = newExpiry - new Date(session.expiresAt).getTime();
    if (gained <= RENEWAL_THRESHOLD_MS) return null;

    const kv = await getKv();
    const key = ["sessions", session.id];
    const entry = await kv.get<SessionInterface>(key);
    if (!entry.value || !entry.value.absoluteExpiresAt) return null;

    const freshNow = Date.now();
    const freshNewExpiry = Math.min(
      freshNow + SESSION_IDLE_TTL_MS,
      new Date(entry.value.absoluteExpiresAt).getTime(),
    );
    const freshGained = freshNewExpiry -
      new Date(entry.value.expiresAt).getTime();
    if (freshGained <= RENEWAL_THRESHOLD_MS) return null;

    const renewed: SessionInterface = {
      ...entry.value,
      expiresAt: new Date(freshNewExpiry),
    };
    const res = await kv.atomic()
      .check({ key, versionstamp: entry.versionstamp })
      .set(key, renewed, { expireIn: freshNewExpiry - freshNow })
      .commit();

    return res.ok ? renewed : null;
  }

  static async findById(id: string): Promise<SessionInterface | null> {
    const kv = await getKv();
    const session = await kv.get<SessionInterface>(["sessions", id]);
    return session.value;
  }

  static async delete(id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["sessions", id]);
  }
}
