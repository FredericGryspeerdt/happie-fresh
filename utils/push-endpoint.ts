/**
 * Derives a push subscription's stable id from its endpoint URL.
 *
 * Must stay byte-stable forever: changing how this is derived would orphan every
 * stored subscription and silently duplicate devices on their next subscribe.
 */
export async function pushEndpointId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
