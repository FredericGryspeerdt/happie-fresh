import type {
  CreatePushSubscriptionDto,
  PushSubscriptionInterface,
} from "@/models/index.ts";
import { pushEndpointId } from "@/utils/push-endpoint.ts";
import { getKv } from "./db.ts";

/**
 * Push subscriptions are stored per household so the delivery sweep — which
 * starts from a to-do, and therefore already knows the householdId — can find
 * every device to notify in one prefix scan with no joins
 * (`["push_subscriptions", householdId, id]`). The owning `userId` rides on the
 * record for when issue #17 makes assignee-targeting possible.
 *
 * Subscriptions deliberately outlive sessions (which expire after 24h), so this
 * is its own aggregate and never hangs off one.
 */
export class PushSubscriptionRepo {
  /** Idempotent by endpoint: re-subscribing the same device overwrites. */
  static async upsert(
    data: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionInterface> {
    const kv = await getKv();
    const id = await pushEndpointId(data.endpoint);
    const sub: PushSubscriptionInterface = { ...data, id };
    await kv.set(["push_subscriptions", data.householdId, id], sub);
    return sub;
  }

  static async getAll(
    householdId: string,
  ): Promise<PushSubscriptionInterface[]> {
    const kv = await getKv();
    const iter = kv.list<PushSubscriptionInterface>({
      prefix: ["push_subscriptions", householdId],
    });
    const subs: PushSubscriptionInterface[] = [];
    for await (const { value } of iter) subs.push(value);
    return subs;
  }

  /** The client holds the endpoint, not its hash, so unsubscribe goes through here. */
  static async deleteByEndpoint(
    householdId: string,
    endpoint: string,
  ): Promise<boolean> {
    const kv = await getKv();
    const id = await pushEndpointId(endpoint);
    const key = ["push_subscriptions", householdId, id];
    const existing = await kv.get<PushSubscriptionInterface>(key);
    if (existing.value === null) return false;
    await kv.delete(key);
    return true;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["push_subscriptions", householdId, id]);
  }
}
