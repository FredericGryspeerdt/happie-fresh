// scripts/kv-export/report.ts
// Console output for the export scripts: collection names and counts only.
import type { ExportSummary, VerifyReport } from "./kv-export.ts";

export function printSummary(summary: ExportSummary): void {
  console.table(
    Object.fromEntries(
      Object.entries(summary.collections).sort().map((
        [collection, entries],
      ) => [collection, { entries }]),
    ),
  );
}

export function printVerifyReport(report: VerifyReport): void {
  console.table(
    Object.fromEntries(Object.entries(report.collections).sort()),
  );
  if (report.duplicateKeysInFile) {
    console.error(`Duplicate keys in file: ${report.duplicateKeysInFile}`);
  }
  console.log(
    report.ok
      ? "✅ Verified: the export matches the source."
      : "❌ Verification failed: the export does not match the source.",
  );
}
