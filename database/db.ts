let kv: Deno.Kv | undefined;

export async function getKv() {
  if (!kv) {
    // Use a local file for development, default (undefined) for Deno Deploy
    const path = Deno.env.get("DENO_DEPLOYMENT_ID") ? undefined : "./kv.db";
    kv = await Deno.openKv(path);
  }
  return kv;
}
