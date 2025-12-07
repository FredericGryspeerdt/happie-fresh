let kv: Deno.Kv | undefined;

export async function getKv() {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}
