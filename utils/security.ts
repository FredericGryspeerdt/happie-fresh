export const ITERATIONS = 310_000;
const HASH = "SHA-256";
const KEY_LEN_BITS = 256;
const PREFIX = "$pbkdf2-sha256$";
const MIN_ITERATIONS = 100_000;

function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(s: string): Uint8Array | null {
  try {
    const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(base64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: HASH, salt: salt as BufferSource, iterations },
    keyMaterial,
    KEY_LEN_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveKey(password, salt, ITERATIONS);
  return `${PREFIX}${ITERATIONS}$${toBase64url(salt)}$${toBase64url(derived)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) return false;
  const parts = stored.split("$");
  // parts: ["", "pbkdf2-sha256", iterations, salt, hash]
  if (parts.length !== 5) return false;
  const iterations = parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations < MIN_ITERATIONS) return false;
  const salt = fromBase64url(parts[3]);
  if (salt === null) return false;
  const expectedHash = fromBase64url(parts[4]);
  if (expectedHash === null) return false;
  const derived = await deriveKey(password, salt, iterations);
  const derivedArr = new Uint8Array(derived);
  if (derivedArr.length !== expectedHash.length) return false;
  return timingSafeEqual(derivedArr, expectedHash);
}
