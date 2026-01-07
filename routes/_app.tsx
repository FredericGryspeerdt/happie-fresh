import { type PageProps } from "fresh";
import { Head } from "fresh/runtime";

interface State {
  userId?: string;
}

export default function App({ Component, state }: PageProps<unknown, State>) {
  return (
    <html>
      <Head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>happie-fresh</title>
        <link
          crossorigin="use-credentials"
          rel="manifest"
          href="/manifest.webmanifest"
        />
        <script type="module">
          import
          "https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate/dist/pwa-update.js";
          const el = document.createElement("pwa-update");
          document.body.appendChild(el);
        </script>
      </Head>
      <body>
        {state?.userId && (
          <header class="p-4 bg-gray-100 flex justify-between items-center border-b">
            <span class="font-bold text-xl">Happie</span>
            <div class="flex gap-4 items-center">
              <a href="/home" class="text-blue-600 hover:underline">
                Shopping list
              </a>
              <a href="/items" class="text-blue-600 hover:underline">
                Items
              </a>
              <a href="/categories/manage" class="text-blue-600 hover:underline">
                Categories
              </a>
              <a href="/logout" class="text-red-600 hover:underline">
                Logout
              </a>
            </div>
          </header>
        )}
        <Component />
      </body>
    </html>
  );
}
