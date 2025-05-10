import { Handlers, PageProps } from "$fresh/server.ts";

interface AboutPageData {
  name: string;
}

export const handler: Handlers = {
  async GET(_req, ctx) {
    const resp = await ctx.render();
    return resp;
  },
};

export default function AboutPage({ data }: PageProps<AboutPageData>) {
  return (
    <main>
      <h1>About</h1>
      <p>This is the about page.</p>
    </main>
  );
}
