import { Handlers, PageProps } from "$fresh/server.ts";
import { ItemInterface } from "./item.interface.ts";

interface Data {
    items: ItemInterface[];
}

export const handler: Handlers<Data> = {
    async GET(_req, ctx) {
        // get data from the database
        const items: ItemInterface[] = [];
        return await ctx.render({ items });
    },
};

export default function ItemsOverviewPage({ data }: PageProps<Data>) {
    const { items } = data || {};
    return (
        <main>
            <h1>Items</h1>
            <p>Een overzicht van alle items</p>

            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <a href={`detail/${item.id}`}>{item.name}</a>
                    </li>
                ))}
            </ul>
        </main>
    );
}
