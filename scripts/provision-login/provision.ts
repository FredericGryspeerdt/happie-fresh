import { UserRepo } from "@/database/user.repo.ts";
import { getKv } from "@/database/db.ts";
import { hashPassword } from "@/utils/index.ts";
import type { UserInterface } from "@/models/index.ts";

/**
 * Decides whether a run is allowed to touch the database it is pointed at.
 *
 * Kept pure and separate from the entrypoint so the safety rules are testable
 * without a KV: this script can be aimed at a remote database, and "which
 * database am I about to write to?" is the only question that really matters.
 */
export interface GuardInput {
  /** Deno Deploy sets this at runtime; unset locally. */
  deploymentId: string | undefined;
  kvPath: string | undefined;
  confirmedRemote: boolean;
}

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function isRemote(kvPath: string | undefined): boolean {
  return !!kvPath && kvPath.startsWith("https://");
}

/**
 * Remote runs need an explicit --confirm-remote because a KV Connect URL for a
 * preview database and one for production look identical apart from the id.
 * Unlike the dev seed this script never deletes anything, so the guard exists to
 * stop you creating an account on production by accident, not to prevent loss.
 */
export function guard(input: GuardInput): GuardResult {
  if (input.deploymentId) {
    return {
      ok: false,
      reason:
        "DENO_DEPLOYMENT_ID is set — this script is a local operator tool and " +
        "must never run inside a deployment.",
    };
  }
  if (isRemote(input.kvPath) && !input.confirmedRemote) {
    return {
      ok: false,
      reason:
        "KV_PATH points at a remote database. Re-run with --confirm-remote " +
        "once you have checked the database id is the one you mean.",
    };
  }
  return { ok: true };
}

/** Extracts the database id from a KV Connect URL, for the confirmation echo. */
export function databaseIdFrom(kvPath: string): string {
  return kvPath.match(/databases\/([^/]+)\/connect/)?.[1] ?? "(unrecognised)";
}

export function validateCredentials(
  username: string,
  password: string,
): GuardResult {
  if (!username) return { ok: false, reason: "--username is required." };
  // Matches routes/login.tsx expectations rather than inventing a new policy;
  // short passwords are rejected only to stop a typo becoming the login.
  if (password.length < 8) {
    return { ok: false, reason: "Password must be at least 8 characters." };
  }
  return { ok: true };
}

export async function listUsers(): Promise<
  { username: string; householdId: string }[]
> {
  const kv = await getKv();
  const out: { username: string; householdId: string }[] = [];
  for await (
    const { value } of kv.list<UserInterface>({ prefix: ["users_by_username"] })
  ) {
    out.push({ username: value.username, householdId: value.householdId });
  }
  return out;
}

export type ProvisionOutcome = "created" | "password-reset";

/**
 * Makes `username` usable with `password`, creating the account if it does not
 * exist and resetting the password if it does.
 *
 * Deliberately additive: it never wipes collections the way the dev seed does,
 * so it is safe to point at a database that already holds real data. Passwords
 * are hashed and cannot be read back, which is why resetting is the only way to
 * recover a login whose password is unknown.
 */
export async function provisionLogin(
  username: string,
  password: string,
): Promise<ProvisionOutcome> {
  const existing = await UserRepo.findByUsername(username);
  if (existing) {
    await UserRepo.updatePasswordHash(
      existing.id,
      await hashPassword(password),
    );
    return "password-reset";
  }
  // UserRepo.create also mints the household and the default shopping list, so
  // the account is immediately usable rather than half-provisioned.
  await UserRepo.create({
    username,
    passwordHash: await hashPassword(password),
  });
  return "created";
}
