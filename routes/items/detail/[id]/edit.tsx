import { PageProps } from "fresh";
import { getKv, ItemRepo } from "@/database/index.ts";
import { Item, type ItemInterface } from "@/models/index.ts";
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
  async POST(_ctx) {
    const req = ctx.req;
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
