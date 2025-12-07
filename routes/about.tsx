import { PageProps } from "fresh";
import { Handlers } from "fresh/compat";

interface AboutPageData {
  name: string;
}

export const handler: Handlers = {
  async GET(ctx) {
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
