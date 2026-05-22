// scripts/seed.ts
import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";
import { hashPassword } from "@/utils/index.ts";

async function seed() {
  const kv = await getKv();

  const username = Deno.env.get("SEED_USERNAME")!;
  const password = Deno.env.get("SEED_PASSWORD")!; // In a real app, use a more secure password or env var

  // Simple check to prevent re-seeding
  const existingUser = await UserRepo.findByUsername(username);
  if (existingUser) {
    console.log(`✅ ${username} user already exists. Seeding skipped.`);
    kv.close();
    return;
  }

  console.log("🌱 Seeding database...");

  const passwordHash = await hashPassword(password);

  await UserRepo.create({
    username,
    passwordHash,
  });

  console.log(`✅ Seed complete. Created user '${username}'.`);
  kv.close();
}

if (import.meta.main) {
  seed().catch((err) => {
    console.error("Seeding failed:", err);
  });
}
