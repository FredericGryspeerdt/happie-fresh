import { PageProps } from "fresh";
import { getKv } from "@/database/index.ts";
import type { ItemInterface } from "@/models/index.ts";
import { Handlers } from "fresh/compat";

interface Data {
  items: ItemInterface[] | null;
}

export const handler: Handlers<Data> = {
  async GET(ctx) {
    // get data from the database
    const kv = await getKv();

    const dbItems: Deno.KvListIterator<ItemInterface> = kv.list<ItemInterface>({
      prefix: ["items"],
    });
    const items = [];
    for await (const res of dbItems) {
      items.push({ ...res.key, ...res.value });
    }
    return await ctx.render({ items });
  },
};

export default function ItemsOverviewPage({ data }: PageProps<Data>) {
  const { items } = data;
  console.log("items", items);
  return (
    <main>
      <h1>Items</h1>
      <p>Een overzicht van alle items</p>

      <ul>
        {(items || []).map((item) => (
          <li key={item.id}>
            <a href={`detail/${item.id}`}>{item.name}</a>
          </li>
        ))}
      </ul>
      <a href={`new`}>Nieuw</a>
    </main>
  );
}
