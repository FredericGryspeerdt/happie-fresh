import { type FreshContext } from "fresh";
import { getKv } from "@/database/index.ts";
import { Button } from "@/components/Button.tsx";
import type { ItemInterface } from "@/models/index.ts";
import { Handlers } from "fresh/compat";

interface Data {
  item: ItemInterface | null;
}

export const handler: Handlers<Data> = {
  async GET(ctx) {
    const id = +ctx.params.id;
    // get the item from the db
    const kv = await getKv();
    const dbItem = await kv.get<ItemInterface>(["items", id]);
    return await ctx.render({ item: dbItem.value });
  },
};

export default async function ItemDetailPage(ctx: FreshContext<Data>) {
  const id = +ctx.params.id;
  // get the item from the db
  const kv = await getKv();
  const dbItem = await kv.get<ItemInterface>(["items", id]);
  const { value: item } = dbItem || {};
  const deleteItem = async () => {
    if (!item?.id) return;
    await kv.delete(["items", item.id]);
  };

  return (
    <main>
      <h1>Item "{item?.name}"</h1>
      <p>This is the item detail page.</p>

      <p>naam: {item?.name}</p>
      <a href={`${item?.id}/edit`}>Pas aan</a>
      <Button onClick={deleteItem}>verwijderen</Button>
    </main>
  );
}
