import { getKv } from "@/database/db.ts";

/** KV collections owned and rebuilt by the dev seed. */
const SEED_PREFIXES: Deno.KvKey[] = [
  ["users"],
  ["users_by_username"],
  ["households"],
  ["categories"],
  ["items"],
  ["shopping_lists"],
  ["shopping_list_items"],
  ["sessions"],
];

/** True on Deno Deploy (production), where seeding must never run. */
export function isProductionEnv(deploymentId: string | undefined): boolean {
  return !!deploymentId;
}

/** Deletes every entry under the seed-owned prefixes. */
export async function resetDatabase(): Promise<void> {
  const kv = await getKv();
  for (const prefix of SEED_PREFIXES) {
    for await (const entry of kv.list({ prefix })) {
      await kv.delete(entry.key);
    }
  }
}
