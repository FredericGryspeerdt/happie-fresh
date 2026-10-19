// scripts/kv-export/codec.ts
// Typed JSON encoding for Deno KV keys and values, used by the NDJSON export
// (issue #153). Plain JSON would turn a `Date` into a string and drop
// `undefined`, `bigint`, `Uint8Array`, `Map`, `Set`, … — so every value JSON
// cannot hold is written as a tagged object `{ "$t": <type>, … }` and decoded
// back to the same structured-clone value. A plain object that itself owns a
// `$t` key is escaped as `{ "$t": "object", "v": [[key, value], …] }` so it
// can never be mistaken for a tag.

export type Encoded =
  | null
  | boolean
  | number
  | string
  | Encoded[]
  | { [key: string]: Encoded };

/** One NDJSON line of an export. */
export interface EncodedEntry {
  key: Encoded[];
  value: Encoded;
  versionstamp: string;
}

const TAG = "$t";

const TYPED_ARRAYS = {
  Int8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
} as const;
type TypedArrayName = keyof typeof TYPED_ARRAYS;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Encodes a KV value (anything structured-clonable, or a `Deno.KvU64`). */
export function encodeValue(value: unknown): Encoded {
  return encode(value, new Set());
}

function encode(value: unknown, path: Set<object>): Encoded {
  switch (typeof value) {
    case "undefined":
      return { [TAG]: "undefined" };
    case "boolean":
    case "string":
      return value;
    case "number":
      if (Number.isFinite(value) && !Object.is(value, -0)) return value;
      return { [TAG]: "number", v: Object.is(value, -0) ? "-0" : `${value}` };
    case "bigint":
      return { [TAG]: "bigint", v: value.toString() };
    case "object":
      break;
    default:
      throw new TypeError(`Cannot encode a value of type ${typeof value}`);
  }
  if (value === null) return null;

  if (path.has(value)) throw new TypeError("Cannot encode a circular value");
  path.add(value);
  try {
    return encodeObject(value, path);
  } finally {
    path.delete(value);
  }
}

function encodeObject(value: object, path: Set<object>): Encoded {
  if (value instanceof Deno.KvU64) {
    return { [TAG]: "KvU64", v: value.value.toString() };
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return {
      [TAG]: "Date",
      v: Number.isNaN(time) ? null : value.toISOString(),
    };
  }
  if (value instanceof Uint8Array) {
    return { [TAG]: "Uint8Array", v: toBase64(value) };
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const name = value.constructor.name as TypedArrayName;
    if (!(name in TYPED_ARRAYS)) {
      throw new TypeError(`Cannot encode a ${name}`);
    }
    const bytes = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );
    return { [TAG]: "TypedArray", type: name, v: toBase64(bytes) };
  }
  if (value instanceof ArrayBuffer) {
    return { [TAG]: "ArrayBuffer", v: toBase64(new Uint8Array(value)) };
  }
  if (value instanceof Map) {
    return {
      [TAG]: "Map",
      v: [...value].map(([k, v]) => [encode(k, path), encode(v, path)]),
    };
  }
  if (value instanceof Set) {
    return { [TAG]: "Set", v: [...value].map((v) => encode(v, path)) };
  }
  if (value instanceof RegExp) {
    return { [TAG]: "RegExp", source: value.source, flags: value.flags };
  }
  if (Array.isArray(value)) {
    const out: Encoded[] = [];
    for (let i = 0; i < value.length; i++) {
      out.push(i in value ? encode(value[i], path) : { [TAG]: "hole" });
    }
    return out;
  }
  if (isPlainObject(value)) {
    if (Object.hasOwn(value, TAG)) {
      return {
        [TAG]: "object",
        v: Object.entries(value).map(([k, v]) => [k, encode(v, path)]),
      };
    }
    const out: Record<string, Encoded> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v, path);
    return out;
  }
  throw new TypeError(
    `Cannot encode a ${value.constructor?.name ?? "non-plain object"}`,
  );
}

/** Decodes a value produced by {@link encodeValue}. */
export function decodeValue(encoded: Encoded): unknown {
  if (encoded === null || typeof encoded !== "object") return encoded;
  if (Array.isArray(encoded)) {
    const out: unknown[] = new Array(encoded.length);
    encoded.forEach((item, i) => {
      if (!isHole(item)) out[i] = decodeValue(item);
    });
    return out;
  }
  if (!Object.hasOwn(encoded, TAG)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(encoded)) out[k] = decodeValue(v);
    return out;
  }
  return decodeTagged(encoded);
}

function isHole(item: Encoded): boolean {
  return item !== null && typeof item === "object" && !Array.isArray(item) &&
    item[TAG] === "hole";
}

function decodeTagged(tagged: { [key: string]: Encoded }): unknown {
  const v = tagged.v;
  switch (tagged[TAG]) {
    case "undefined":
      return undefined;
    case "number":
      return v === "-0" ? -0 : Number(v);
    case "bigint":
      return BigInt(v as string);
    case "KvU64":
      return new Deno.KvU64(BigInt(v as string));
    case "Date":
      return new Date(v === null ? NaN : v as string);
    case "Uint8Array":
      return fromBase64(v as string);
    case "TypedArray": {
      const Ctor = TYPED_ARRAYS[tagged.type as TypedArrayName];
      if (!Ctor) throw new TypeError(`Unknown typed array ${tagged.type}`);
      return new Ctor(fromBase64(v as string).buffer);
    }
    case "ArrayBuffer":
      return fromBase64(v as string).buffer;
    case "Map":
      return new Map(
        (v as Encoded[][]).map((
          [k, val],
        ) => [decodeValue(k), decodeValue(val)]),
      );
    case "Set":
      return new Set((v as Encoded[]).map(decodeValue));
    case "RegExp":
      return new RegExp(tagged.source as string, tagged.flags as string);
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, val] of v as [string, Encoded][]) {
        out[k] = decodeValue(val);
      }
      return out;
    }
    default:
      throw new TypeError(
        `Unknown encoded type ${JSON.stringify(tagged[TAG])}`,
      );
  }
}

/** Encodes a KV key (strings, numbers, bigints, booleans, Uint8Arrays). */
export function encodeKey(key: Deno.KvKey): Encoded[] {
  return key.map((part) => encodeValue(part));
}

export function decodeKey(encoded: Encoded[]): Deno.KvKey {
  return encoded.map((part) => decodeValue(part) as Deno.KvKeyPart);
}

export function encodeEntry(entry: Deno.KvEntry<unknown>): EncodedEntry {
  return {
    key: encodeKey(entry.key),
    value: encodeValue(entry.value),
    versionstamp: entry.versionstamp,
  };
}

/** Serialises one entry as a single NDJSON line (without the newline). */
export function entryToLine(entry: Deno.KvEntry<unknown>): string {
  return JSON.stringify(encodeEntry(entry));
}

/** Parses one NDJSON line back into a KV key, value and versionstamp. */
export function lineToEntry(line: string): Deno.KvEntry<unknown> {
  const parsed = JSON.parse(line) as EncodedEntry;
  if (!Array.isArray(parsed.key) || typeof parsed.versionstamp !== "string") {
    throw new TypeError("Malformed export line");
  }
  return {
    key: decodeKey(parsed.key),
    value: decodeValue(parsed.value),
    versionstamp: parsed.versionstamp,
  };
}

/** JSON with object keys sorted, so equal values always hash the same. */
export function canonicalJson(encoded: Encoded): string {
  if (encoded === null || typeof encoded !== "object") {
    return JSON.stringify(encoded);
  }
  if (Array.isArray(encoded)) {
    return `[${encoded.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(encoded).sort();
  return `{${
    keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(encoded[k])}`).join(
      ",",
    )
  }}`;
}

/** Stable identity of a key, usable as a Map key. */
export function keyId(key: Deno.KvKey): string {
  return canonicalJson(encodeKey(key));
}

/** SHA-256 (hex) over the canonical encoding of an entry's key and value. */
export async function hashEntry(
  key: Deno.KvKey,
  value: unknown,
): Promise<string> {
  const text = canonicalJson({ k: encodeKey(key), v: encodeValue(value) });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Top-level collection name of a key, e.g. `["todos", id]` → `todos`. */
export function collectionOf(key: Deno.KvKey): string {
  const first = key[0];
  return typeof first === "string" ? first : canonicalJson(encodeValue(first));
}
