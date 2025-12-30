let kv: Deno.Kv | undefined;

export async function getKv() {
  if (!kv) {
    const isDeploy = !!Deno.env.get("DENO_DEPLOYMENT_ID");
    let path: string | undefined;

    if (!isDeploy) {
      // Allow overriding via env
      path = Deno.env.get("KV_PATH") ?? "../../data/kv.db";

      // Only create directory if it's a local file path (not a remote URL)
      if (!path.startsWith("https://")) {
        try {
          const normalized = path.replace(/\\+/g, "/");
          const dir = normalized.split("/").slice(0, -1).join("/");
          if (dir) {
            await Deno.mkdir(dir, { recursive: true });
          }
        } catch (_) {
          // Directory may already exist; ignore errors
        }
      }
    }
    // If isDeploy is true, path is undefined (uses default KV for deployment)
    // If local and path is a URL, it connects remotely
    // If local and path is a file, it connects locally
    kv = await Deno.openKv(path);
  }
  return kv;
}
