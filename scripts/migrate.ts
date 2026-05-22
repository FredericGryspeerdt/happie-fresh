import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";
import { hashPassword, timingSafeEqual } from "@/utils/index.ts";
import { UserInterface } from "@/models/index.ts";

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

async function sha256Hex(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function migrate() {
  const password = Deno.env.get("SEED_PASSWORD");
  if (!password) {
    console.error("❌ SEED_PASSWORD env var is required.");
    Deno.exit(1);
  }

  const kv = await getKv();
  try {
    let migrated = 0;
    let skippedMismatch = 0;
    let alreadyMigrated = 0;

    const legacyHash = await sha256Hex(password);

    for await (const entry of kv.list<UserInterface>({ prefix: ["users"] })) {
      const user = entry.value;
      if (!user) continue;

      if (!isLegacyHash(user.passwordHash)) {
        alreadyMigrated++;
        continue;
      }

      const encoder = new TextEncoder();
      if (!timingSafeEqual(encoder.encode(user.passwordHash), encoder.encode(legacyHash))) {
        console.warn(
          `⚠️  Skipped '${user.username}' — stored hash does not match SEED_PASSWORD.`,
        );
        skippedMismatch++;
        continue;
      }

      const newHash = await hashPassword(password);
      await UserRepo.updatePasswordHash(user.id, newHash);
      console.log(`✅ Migrated '${user.username}'`);
      migrated++;
    }

    console.log(
      `\nDone. ${migrated} migrated, ${skippedMismatch} skipped (password mismatch), ${alreadyMigrated} already on PBKDF2.`,
    );
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    Deno.exit(1);
  });
}
