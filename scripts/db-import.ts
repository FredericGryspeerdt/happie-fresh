// scripts/db-import.ts
// `KV_PATH=<local file> deno task db:import --in <file>`
//
// Restores an export made by `db:export` into an EMPTY local file KV. Refuses
// to run on Deno Deploy, without an explicit KV_PATH, or when KV_PATH is a
// remote / KV Connect URL — this script must never write to production.
// TTLs (`expireIn`) are not part of an export, so restored entries never
// expire. Follow with `deno task db:verify --in <file>`.
import { parseArgs } from "jsr:@std/cli@^1.0.0/parse-args";
import { getKv } from "@/database/db.ts";
import { assertLocalKvPath, importKv } from "./kv-export/kv-export.ts";
import { printSummary } from "./kv-export/report.ts";

async function main(): Promise<number> {
  const args = parseArgs(Deno.args, { string: ["in"] });
  if (!args.in) {
    console.error(
      "Usage: KV_PATH=<local file> deno task db:import --in <file>",
    );
    return 2;
  }
  const kvPath = Deno.env.get("KV_PATH");
  assertLocalKvPath(kvPath, Deno.env.get("DENO_DEPLOYMENT_ID"));

  const kv = await getKv();
  try {
    const summary = await importKv(kv, args.in);
    console.log(`📥 Restored ${summary.total} entries into ${kvPath}`);
    printSummary(summary);
    return 0;
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  main().then(Deno.exit, (err) => {
    console.error(`❌ Restore failed: ${(err as Error).message}`);
    Deno.exit(1);
  });
}
