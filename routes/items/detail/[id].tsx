import { Handlers, PageProps } from "$fresh/server.ts";
import { ItemInterface } from "../item.interface.ts";

interface Data {
    item: ItemInterface;
}

export const handler: Handlers<Data> = {
    async GET(_req, ctx) {
        const id = +ctx.params.id;
        // get the item from the db
        const dbItem: ItemInterface = { id, name: "test" };
        return await ctx.render({ item: dbItem });
    },
};

export default function ItemDetailPage({ data }: PageProps<Data>) {
    const { item } = data || {};
    console.log(item);
    return (
        <main>
            <h1>Item {item.name}</h1>
            <p>This is the item detail page.</p>

            <p>naam: {item.name}</p>
        </main>
    );
}
