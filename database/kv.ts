import { getKv } from "./db.ts";

export async function getKvValue<T>(key: Deno.KvKey): Promise<T | null> {
  const kv = await getKv();
  return (await kv.get<T>(key)).value;
}

export async function listKvValues<T>(prefix: Deno.KvKey): Promise<T[]> {
  const kv = await getKv();
  const values: T[] = [];
  for await (const entry of kv.list<T>({ prefix })) values.push(entry.value);
  return values;
}

export async function setKvValue<T>(
  key: Deno.KvKey,
  value: T,
): Promise<Deno.KvCommitResult> {
  const kv = await getKv();
  return await kv.set(key, value);
}

export async function deleteKvValue(key: Deno.KvKey): Promise<void> {
  const kv = await getKv();
  await kv.delete(key);
}
