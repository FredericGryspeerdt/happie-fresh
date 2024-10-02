import { Handlers, PageProps } from "$fresh/server.ts";
import { ItemInterface } from "./item.interface.ts";

interface Data {
}

export const handler: Handlers<Data> = {
    async GET(_req, ctx) {
        return await ctx.render();
    },
    async POST(req, ctx) {
        const form = await req.formData();
        const name = form.get("name")?.toString();
        // validate the form
        // save the item to the db
        const id = 111;

        // Redirect user to item detail page.
        const headers = new Headers();
        headers.set("location", `detail/${id}`);

        return new Response(null, {
            status: 303,
            headers,
        });
    },
};

export default function ItemNewPage(_data: PageProps<Data>) {
    return (
        <main>
            <h1>Nieuw item</h1>
            <p>Maak een nieuw item.</p>

            <form method="post">
                <input
                    type="text"
                    placeholder="naam van het product"
                    name="name"
                />

                <button type="submit">Opslaan</button>
            </form>
        </main>
    );
}
