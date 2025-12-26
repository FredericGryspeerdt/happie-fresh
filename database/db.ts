let kv: Deno.Kv | undefined;

export async function getKv() {
  if (!kv) {
    const isDeploy = !!Deno.env.get("DENO_DEPLOYMENT_ID");
    let path: string | undefined;
    if (!isDeploy) {
      // Allow overriding via env; default outside workspace to avoid HMR watches
      path = Deno.env.get("KV_PATH") ?? "../../data/kv.db";
      try {
        const normalized = path.replace(/\\+/g, "/");
        const dir = normalized.split("/").slice(0, -1).join("/");
        await Deno.mkdir(dir, { recursive: true });
      } catch (_) {
        // Directory may already exist; ignore errors
      }
    }
    kv = await Deno.openKv(path);
  }
  return kv;
}
