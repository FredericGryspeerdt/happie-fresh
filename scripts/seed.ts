// scripts/seed.ts
import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return hashHex;
}

async function seed() {
  const kv = await getKv();

  // Simple check to prevent re-seeding
  const existingUser = await UserRepo.findByUsername("admin");
  if (existingUser) {
    console.log("✅ Admin user already exists. Seeding skipped.");
    kv.close();
    return;
  }

  console.log("🌱 Seeding database...");

  const username = "admin";
  const password = "password"; // In a real app, use a more secure password or env var
  const passwordHash = await hashPassword(password);

  await UserRepo.create({
    username,
    passwordHash,
  });

  console.log(
    `✅ Seed complete. Created user 'admin' with password 'password'.`,
  );
  kv.close();
}

if (import.meta.main) {
  seed().catch((err) => {
    console.error("Seeding failed:", err);
  });
}
