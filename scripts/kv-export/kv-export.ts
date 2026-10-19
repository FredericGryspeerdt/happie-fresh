// scripts/kv-export/kv-export.ts
// Export, verify and restore a whole Deno KV as typed NDJSON (issue #153).
// Export and verify only ever *read* the source KV (`kv.list`). Restore only
// writes to a local file / in-memory KV — see `assertLocalKvPath`.
//
// Nothing here prints keys or values: reports carry collection names and
// counts only, because the production export runs in public CI logs.
import {
  collectionOf,
  entryToLine,
  hashEntry,
  keyId,
  lineToEntry,
} from "./codec.ts";

/** `list()` reads at most 500 keys per snapshot batch. */
const BATCH_SIZE = 500;

export interface ExportSummary {
  total: number;
  collections: Record<string, number>;
}

/** Reads every entry of `kv` (read-only) and writes one NDJSON line each. */
export async function exportKv(
  kv: Deno.Kv,
  outPath: string,
): Promise<ExportSummary> {
  const file = await Deno.open(outPath, {
    write: true,
    createNew: true,
    mode: 0o600,
  });
  const encoder = new TextEncoder();
  const summary: ExportSummary = { total: 0, collections: {} };
  try {
    let buffer: string[] = [];
    for await (
      const entry of kv.list({ prefix: [] }, { batchSize: BATCH_SIZE })
    ) {
      buffer.push(entryToLine(entry));
      summary.total++;
      const collection = collectionOf(entry.key);
      summary.collections[collection] = (summary.collections[collection] ?? 0) +
        1;
      if (buffer.length >= BATCH_SIZE) {
        await writeAll(file, encoder.encode(buffer.join("\n") + "\n"));
        buffer = [];
      }
    }
    if (buffer.length) {
      await writeAll(file, encoder.encode(buffer.join("\n") + "\n"));
    }
  } finally {
    file.close();
  }
  return summary;
}

async function writeAll(file: Deno.FsFile, bytes: Uint8Array): Promise<void> {
  let written = 0;
  while (written < bytes.length) {
    written += await file.write(bytes.subarray(written));
  }
}

/** Yields the decoded entries of an export file, one per non-empty line. */
export async function* readExport(
  path: string,
): AsyncGenerator<Deno.KvEntry<unknown>> {
  const file = await Deno.open(path, { read: true });
  const lines = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new LineSplitStream());
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber++;
    if (!line.trim()) continue;
    try {
      yield lineToEntry(line);
    } catch (err) {
      // Never echo the line itself: it may hold production values.
      throw new Error(
        `Export line ${lineNumber} is unreadable: ${(err as Error).name}`,
      );
    }
  }
}

class LineSplitStream extends TransformStream<string, string> {
  constructor() {
    let rest = "";
    super({
      transform(chunk, controller) {
        const parts = (rest + chunk).split("\n");
        rest = parts.pop() ?? "";
        for (const part of parts) controller.enqueue(part);
      },
      flush(controller) {
        if (rest) controller.enqueue(rest);
      },
    });
  }
}

export interface CollectionReport {
  source: number;
  file: number;
  missingFromFile: number;
  extraInFile: number;
  valueMismatches: number;
  versionstampMismatches: number;
}

export interface VerifyReport {
  ok: boolean;
  duplicateKeysInFile: number;
  collections: Record<string, CollectionReport>;
}

export interface VerifyOptions {
  /**
   * Also require identical versionstamps. On right after an export from the
   * same database (a changed versionstamp means a write slipped in); off when
   * checking a restore, which gets fresh versionstamps.
   */
  versionstamps: boolean;
}

/**
 * Compares an export file against `kv` (read-only): entry counts per
 * top-level collection and a SHA-256 of each entry's key and decoded value.
 */
export async function verifyExport(
  kv: Deno.Kv,
  path: string,
  options: VerifyOptions,
): Promise<VerifyReport> {
  const report: VerifyReport = {
    ok: true,
    duplicateKeysInFile: 0,
    collections: {},
  };
  const row = (collection: string) =>
    report.collections[collection] ??= {
      source: 0,
      file: 0,
      missingFromFile: 0,
      extraInFile: 0,
      valueMismatches: 0,
      versionstampMismatches: 0,
    };

  const fromFile = new Map<
    string,
    { collection: string; hash: string; versionstamp: string }
  >();
  for await (const entry of readExport(path)) {
    const id = keyId(entry.key);
    const collection = collectionOf(entry.key);
    row(collection).file++;
    if (fromFile.has(id)) {
      report.duplicateKeysInFile++;
      continue;
    }
    fromFile.set(id, {
      collection,
      hash: await hashEntry(entry.key, entry.value),
      versionstamp: entry.versionstamp,
    });
  }

  for await (
    const entry of kv.list({ prefix: [] }, { batchSize: BATCH_SIZE })
  ) {
    const id = keyId(entry.key);
    const stats = row(collectionOf(entry.key));
    stats.source++;
    const exported = fromFile.get(id);
    if (!exported) {
      stats.missingFromFile++;
      continue;
    }
    fromFile.delete(id);
    if (exported.hash !== await hashEntry(entry.key, entry.value)) {
      stats.valueMismatches++;
    }
    if (options.versionstamps && exported.versionstamp !== entry.versionstamp) {
      stats.versionstampMismatches++;
    }
  }
  for (const { collection } of fromFile.values()) row(collection).extraInFile++;

  report.ok = report.duplicateKeysInFile === 0 &&
    Object.values(report.collections).every((c) =>
      c.source === c.file && c.missingFromFile === 0 && c.extraInFile === 0 &&
      c.valueMismatches === 0 && c.versionstampMismatches === 0
    );
  return report;
}

/** True for KV paths that reach a remote database (KV Connect URLs). */
export function isRemoteKvPath(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path.trim());
}

/**
 * Restore only ever targets a local file (or `:memory:`) KV. Throws for a
 * missing path, a remote / KV Connect URL, or when running on Deno Deploy.
 */
export function assertLocalKvPath(
  path: string | undefined,
  deploymentId: string | undefined,
): asserts path is string {
  if (deploymentId) {
    throw new Error("Refusing to restore on Deno Deploy (DENO_DEPLOYMENT_ID).");
  }
  if (!path?.trim()) {
    throw new Error("Set KV_PATH to the local KV file to restore into.");
  }
  if (isRemoteKvPath(path)) {
    throw new Error(
      "Refusing to restore into a remote KV: KV_PATH must be a local file.",
    );
  }
}

/** Writes every entry of an export into `kv`, which must be empty. */
export async function importKv(
  kv: Deno.Kv,
  path: string,
): Promise<ExportSummary> {
  for await (const _ of kv.list({ prefix: [] }, { limit: 1 })) {
    throw new Error("Refusing to restore into a non-empty KV.");
  }
  const summary: ExportSummary = { total: 0, collections: {} };
  for await (const entry of readExport(path)) {
    await kv.set(entry.key, entry.value);
    summary.total++;
    const collection = collectionOf(entry.key);
    summary.collections[collection] = (summary.collections[collection] ?? 0) +
      1;
  }
  return summary;
}

/** Field paths and the value types seen at each, per collection. No values. */
export async function describeShapes(
  kv: Deno.Kv,
): Promise<Record<string, Record<string, string[]>>> {
  const shapes: Record<string, Record<string, Set<string>>> = {};
  for await (
    const entry of kv.list({ prefix: [] }, { batchSize: BATCH_SIZE })
  ) {
    const fields = shapes[collectionOf(entry.key)] ??= {};
    const keyTypes = entry.key.slice(1).map(typeName).join(", ");
    (fields["(key)"] ??= new Set()).add(`[${keyTypes}]`);
    collectShape(entry.value, "", fields);
  }
  return Object.fromEntries(
    Object.entries(shapes).map(([collection, fields]) => [
      collection,
      Object.fromEntries(
        Object.entries(fields).map(([field, types]) => [field, [...types]]),
      ),
    ]),
  );
}

/** Object keys that are ids (UUIDs, numbers, dates) collapse to `<id>`. */
const ID_LIKE = /^([0-9a-f-]{16,}|\d+|\d{4}-\d{2}-\d{2}.*)$/i;

function collectShape(
  value: unknown,
  path: string,
  fields: Record<string, Set<string>>,
): void {
  const here = path || "(value)";
  (fields[here] ??= new Set()).add(typeName(value));
  if (Array.isArray(value)) {
    for (const item of value) collectShape(item, `${path}[]`, fields);
  } else if (
    value !== null && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    for (const [k, v] of Object.entries(value)) {
      const name = ID_LIKE.test(k) ? "<id>" : k;
      collectShape(v, path ? `${path}.${name}` : name, fields);
    }
  }
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") {
    const name = value.constructor?.name;
    return name && name !== "Object" ? name : "object";
  }
  return typeof value;
}
