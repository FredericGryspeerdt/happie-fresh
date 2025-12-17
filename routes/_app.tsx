import { type PageProps } from "fresh";

interface State {
  userId?: string;
}

export default function App({ Component, state }: PageProps<unknown, State>) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>happie-fresh</title>
      </head>
      <body>
        {state?.userId && (
          <header class="p-4 bg-gray-100 flex justify-between items-center border-b">
            <span class="font-bold text-xl">Happie Fresh</span>
            <a href="/logout" class="text-red-600 hover:underline">
              Logout
            </a>
          </header>
        )}
        <Component />
      </body>
    </html>
  );
}
