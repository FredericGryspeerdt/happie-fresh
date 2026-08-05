export interface PushSubscriptionInterface {
  /**
   * SHA-256 hex of the endpoint URL. Derived rather than random so that a device
   * re-subscribing (permission re-granted, endpoint rotated, site data cleared)
   * upserts instead of creating a second row — otherwise one phone would get two
   * notifications for the same to-do.
   */
  id: string;
  householdId: string;
  /**
   * The user whose device this is. Stored but not yet used for targeting: today a
   * household has one user, and narrowing to a to-do's assignees needs the
   * member model from issue #17.
   */
  userId: string;
  /** The push service URL this device is reachable at. */
  endpoint: string;
  /** From the browser's PushSubscription — the ECDH public key. */
  p256dh: string;
  /** From the browser's PushSubscription — the auth secret. */
  auth: string;
  createdAt: string;
}

// Derived type for creation (no ID — the repo derives it from the endpoint).
export type CreatePushSubscriptionDto = Omit<PushSubscriptionInterface, "id">;

/**
 * What the client sends. The server fills in `id`, `householdId`, `userId` and
 * `createdAt` from the session — the client never sends (and cannot spoof) the
 * household.
 */
export type PushSubscriptionInput = Pick<
  PushSubscriptionInterface,
  "endpoint" | "p256dh" | "auth"
>;
