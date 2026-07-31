// scripts/seed.ts
// Dev-only seed entrypoint. Resets the seed-owned KV collections and rebuilds
// them from hand-authored fixtures. Never runs on Deno Deploy (production).
import { getKv } from "@/database/db.ts";
import { isProductionEnv, isRemoteKvPath, runSeed } from "./seed/runner.ts";

async function main() {
  if (isProductionEnv(Deno.env.get("DENO_DEPLOYMENT_ID"))) {
    console.error(
      "❌ Refusing to seed: DENO_DEPLOYMENT_ID is set (production). " +
        "The dev seed is destructive and must only run locally.",
    );
    Deno.exit(1);
  }

  if (isRemoteKvPath(Deno.env.get("KV_PATH"))) {
    console.error(
      "❌ Refusing to seed: KV_PATH points at a remote (https) database. " +
        "The dev seed is destructive and must only run against a local KV.",
    );
    Deno.exit(1);
  }

  console.log("🌱 Resetting and seeding database...");
  await runSeed({
    primaryUsername: Deno.env.get("SEED_USERNAME") ?? undefined,
    primaryPassword: Deno.env.get("SEED_PASSWORD") ?? undefined,
  });
  console.log("✅ Seed complete.");

  const kv = await getKv();
  kv.close();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Seeding failed:", err);
    Deno.exit(1);
  });
}
