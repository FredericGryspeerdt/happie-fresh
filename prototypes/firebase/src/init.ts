// THROWAWAY: generate credentials exclusively for the disposable spike.
// Writes .env.spike (for smoke/local runs) and env.yaml (for Cloud Run).
import { existsSync, writeFileSync } from "node:fs";
import webpush from "web-push";
import { hashPassword } from "./security.ts";

const dir = new URL("../", import.meta.url);
if (existsSync(new URL(".env.spike", dir))) {
  console.info("Keeping existing spike credentials.");
} else {
  const keys = webpush.generateVAPIDKeys();
  const vars: Record<string, string> = {
    PROTOTYPE_TOKEN: crypto.randomUUID(),
    SWEEP_TOKEN: crypto.randomUUID(),
    PROTOTYPE_PASSWORD_HASH: await hashPassword("prototype-password"),
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  };
  const lines = (sep: string) =>
    Object.entries(vars).map(([k, v]) => `${k}${sep}${JSON.stringify(v)}`).join("\n") + "\n";
  writeFileSync(new URL(".env.spike", dir), lines("="), { mode: 0o600 });
  writeFileSync(new URL("env.yaml", dir), lines(": "), { mode: 0o600 });
  console.info("Created ignored .env.spike and env.yaml with disposable credentials.");
}
