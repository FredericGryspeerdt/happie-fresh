import { Handlers, PageProps } from "$fresh/server.ts";
import { kv } from "../../../../database/db.ts";
import { Item, type ItemInterface } from "../../../../models/item/index.ts";
import { ItemRepo } from "../../../../database/item.repo.ts";
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
  async POST(req, _ctx) {
    const form = await req.formData();
    const name = form.get("name")?.toString();
    // validate the form

    // save the item to the db

    const item: ItemInterface = new Item(name || "unknown");

    const newItem = await ItemRepo.create(item);

    // Redirect user to item detail page.
    const headers = new Headers();
    headers.set("location", `/items/detail/${newItem.id}`);

    return new Response(null, {
      status: 303,
      headers,
    });
  },
};

export default function ItemDetailPage({ data }: PageProps<Data>) {
  const { item } = data || {};
  return (
    <main>
      <h1>Editeer item</h1>
      <p>Editeer een bestaand item.</p>

      <form method="post">
        <input
          type="text"
          placeholder="naam van het product"
          name="name"
          value={item?.name}
        />

        <button type="submit">Opslaan</button>
      </form>
    </main>
  );
}
