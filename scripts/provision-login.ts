// scripts/provision-login.ts
//
// Operator tool: create a login, or reset a known one, against whichever KV
// `KV_PATH` points at — including a remote Deno Deploy database over KV Connect.
//
// Why this exists alongside `deno task db:seed`: the seed is destructive (it
// wipes and rebuilds whole collections) and therefore refuses to run against a
// remote database. Deno Deploy gives every preview deployment its **own** KV,
// so a preview starts with no accounts at all and production credentials do not
// work there. This script provisions just enough to log in, without deleting
// anything, so it is safe to aim at a database that holds real data.
//
// Passwords are PBKDF2-hashed and cannot be read back, so an unknown password
// can only be reset, never recovered. `--list` shows which usernames exist.
import { getKv } from "@/database/db.ts";
import {
  databaseIdFrom,
  guard,
  isRemote,
  listUsers,
  provisionLogin,
  validateCredentials,
} from "./provision-login/provision.ts";

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = Deno.args.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

function usage() {
  console.log(`
Provision a login for local dev or a Deno Deploy preview.

  deno task db:login --list
  deno task db:login --username <name> [--password <pw>]

Options
  --list             List existing usernames (passwords cannot be recovered).
  --username <name>  The account to create, or whose password to reset.
  --password <pw>    The password to set. Prefer LOGIN_PASSWORD to keep it out
                     of your shell history. Minimum 8 characters.
  --confirm-remote   Required when KV_PATH is an https:// KV Connect URL.

Targeting a Deno Deploy preview database:

  KV_PATH="https://api.deno.com/v2/databases/<PREVIEW_DB_ID>/connect" \\
  DENO_KV_ACCESS_TOKEN="<deno-deploy-org-access-token>" \\
  LOGIN_PASSWORD="<password>" \\
  deno task db:login --username tester --confirm-remote

Find <PREVIEW_DB_ID> in the Deno Deploy console under Databases — pick the one
for this branch/preview timeline, NOT production.
`);
}

async function main() {
  if (Deno.args.includes("--help") || Deno.args.length === 0) {
    usage();
    return;
  }

  const kvPath = Deno.env.get("KV_PATH");
  const verdict = guard({
    deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),
    kvPath,
    confirmedRemote: Deno.args.includes("--confirm-remote"),
  });
  if (!verdict.ok) {
    console.error(`❌ ${verdict.reason}`);
    Deno.exit(1);
  }

  const target = kvPath && isRemote(kvPath)
    ? `remote database ${databaseIdFrom(kvPath)}`
    : `local ${kvPath ?? "../../data/kv.db"}`;
  console.log(`🎯 Target: ${target}`);

  if (Deno.args.includes("--list")) {
    const users = await listUsers();
    if (users.length === 0) {
      console.log(
        "No users. This is expected for a fresh preview database — " +
          "create one with --username.",
      );
    } else {
      console.log(`\n${users.length} user(s):`);
      for (const u of users) console.log(`  ${u.username}`);
    }
    (await getKv()).close();
    return;
  }

  const username = flag("username") ?? "";
  const password = flag("password") ?? Deno.env.get("LOGIN_PASSWORD") ?? "";

  const creds = validateCredentials(username, password);
  if (!creds.ok) {
    console.error(`❌ ${creds.reason}`);
    Deno.exit(1);
  }

  const outcome = await provisionLogin(username, password);
  console.log(
    outcome === "created"
      ? `✅ Created '${username}' with a new household and shopping list.`
      : `✅ Reset the password for the existing user '${username}'.`,
  );
  console.log("   You can now log in with the password you supplied.");

  (await getKv()).close();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Provisioning failed:", err);
    Deno.exit(1);
  });
}
