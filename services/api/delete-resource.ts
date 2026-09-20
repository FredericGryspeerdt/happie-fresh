/** DELETE failures are values so optimistic callers can restore their rows. */
export async function deleteResource(
  url: string,
  init?: RequestInit,
): Promise<boolean> {
  try {
    const res = await fetch(url, { ...init, method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
