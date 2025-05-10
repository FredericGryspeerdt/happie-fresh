import { Handlers, type FreshContext } from "$fresh/server.ts";
import { kv } from "../../../../database/db.ts";
import { Button } from "../../../../components/Button.tsx";
import type { ItemInterface } from "../../../../models/item/index.ts";
interface Data {
  item: ItemInterface | null;
}

export const handler: Handlers<Data> = {
  async GET(_req, ctx) {
    const id = +ctx.params.id;
    // get the item from the db
    const dbItem = await kv.get<ItemInterface>(["items", id]);
    return await ctx.render({ item: dbItem.value });
  },
};

export default async function ItemDetailPage(
  _req: Request,
  ctx: FreshContext<Data>
) {
  const id = +ctx.params.id;
  // get the item from the db
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
