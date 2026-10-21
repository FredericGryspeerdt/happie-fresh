// scripts/db-verify.ts
// `deno task db:verify --in <file> [--versionstamps] [--shapes]`
//
// Compares an export file against the KV selected by KV_PATH (read-only):
// counts per collection and a value hash per entry. Use it after `db:import`
// to prove a restore is complete. `--versionstamps` also requires identical
// versionstamps (only meaningful against the database that was exported).
// `--shapes` prints field names and value types per collection — no values.
import { parseArgs } from "jsr:@std/cli@^1.0.0/parse-args";
import { getKv } from "@/database/db.ts";
import { describeShapes, verifyExport } from "./kv-export/kv-export.ts";
import { printVerifyReport } from "./kv-export/report.ts";

async function main(): Promise<number> {
  const args = parseArgs(Deno.args, {
    string: ["in"],
    boolean: ["versionstamps", "shapes"],
  });
  if (!args.in) {
    console.error("Usage: deno task db:verify --in <export.ndjson>");
    return 2;
  }

  const kv = await getKv();
  try {
    const report = await verifyExport(kv, args.in, {
      versionstamps: args.versionstamps,
    });
    printVerifyReport(report);
    if (args.shapes) {
      for (
        const [collection, fields] of Object.entries(await describeShapes(kv))
          .sort()
      ) {
        console.log(`\n${collection}`);
        for (const [field, types] of Object.entries(fields)) {
          console.log(`  ${field}: ${types.join(" | ")}`);
        }
      }
    }
    return report.ok ? 0 : 1;
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  main().then(Deno.exit, (err) => {
    console.error(`❌ Verify failed: ${(err as Error).message}`);
    Deno.exit(1);
  });
}
