// scripts/seed.ts
import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";
import { hashPassword } from "@/utils/index.ts";

async function seed() {
  const kv = await getKv();

  //   delete all existing users
  await UserRepo.deleteAll();

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
