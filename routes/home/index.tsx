import { Handlers, PageProps } from "$fresh/server.ts";
import { ItemRepo } from "../../database/item.repo.ts";
import ItemsIsland from "../../islands/items.tsx";
import { ItemInterface } from "../../models/item/item.interface.ts";

interface Data {
  items: ItemInterface[];
}

export const handler: Handlers<Data> = {
  async GET(_req, _ctx) {
    const items = await ItemRepo.readAll();
    return _ctx.render({ items });
  },
};

export default function Home({ data }: PageProps<Data>) {
  return (
    <main class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">Home</h1>
      <ItemsIsland data={data.items} />
    </main>
  );
}
