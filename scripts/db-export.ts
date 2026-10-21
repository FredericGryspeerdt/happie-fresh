// scripts/db-export.ts
// `deno task db:export [--out <file>] [--verify] [--allow-empty]`
//
// Writes every entry of the KV selected by KV_PATH (see database/db.ts) as
// typed NDJSON — one line per entry: key parts, value, versionstamp. Read-only
// against the source. Prints counts per collection, never keys or values.
// `--verify` re-reads the file and compares it with the source (counts,
// value hashes and versionstamps), exiting non-zero on any mismatch.
// See docs/running-migrations.md#exporting-production-kv (issue #153).
import { parseArgs } from "jsr:@std/cli@^1.0.0/parse-args";
import { getKv } from "@/database/db.ts";
import { exportKv } from "./kv-export/kv-export.ts";
import { printSummary, printVerifyReport } from "./kv-export/report.ts";
import { verifyExport } from "./kv-export/kv-export.ts";

async function main(): Promise<number> {
  const args = parseArgs(Deno.args, {
    string: ["out"],
    boolean: ["verify", "allow-empty"],
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = args.out ?? `exports/kv-export-${stamp}.ndjson`;
  const dir = out.split("/").slice(0, -1).join("/");
  if (dir) await Deno.mkdir(dir, { recursive: true });

  const kv = await getKv();
  try {
    const started = performance.now();
    const summary = await exportKv(kv, out);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`📦 Exported ${summary.total} entries in ${seconds}s → ${out}`);
    printSummary(summary);
    if (summary.total === 0 && !args["allow-empty"]) {
      // An empty source almost always means the wrong database (e.g. the
      // empty build-sandbox KV, see docs/running-migrations.md).
      console.error(
        "❌ The source KV is empty. Pass --allow-empty if expected.",
      );
      return 1;
    }

    if (!args.verify) return 0;
    const report = await verifyExport(kv, out, { versionstamps: true });
    printVerifyReport(report);
    return report.ok ? 0 : 1;
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  main().then(Deno.exit, (err) => {
    console.error(`❌ Export failed: ${(err as Error).message}`);
    Deno.exit(1);
  });
}
