// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from "./routes/_404.tsx";
import * as $_app from "./routes/_app.tsx";
import * as $about from "./routes/about.tsx";
import * as $api_joke from "./routes/api/joke.ts";
import * as $greet_name_ from "./routes/greet/[name].tsx";
import * as $index from "./routes/index.tsx";
import * as $items_detail_id_ from "./routes/items/detail/[id].tsx";
import * as $items_item_interface from "./routes/items/item.interface.ts";
import * as $items_new from "./routes/items/new.tsx";
import * as $items_overview from "./routes/items/overview.tsx";
import * as $login from "./routes/login.tsx";
import * as $Counter from "./islands/Counter.tsx";
import { type Manifest } from "$fresh/server.ts";

const manifest = {
  routes: {
    "./routes/_404.tsx": $_404,
    "./routes/_app.tsx": $_app,
    "./routes/about.tsx": $about,
    "./routes/api/joke.ts": $api_joke,
    "./routes/greet/[name].tsx": $greet_name_,
    "./routes/index.tsx": $index,
    "./routes/items/detail/[id].tsx": $items_detail_id_,
    "./routes/items/item.interface.ts": $items_item_interface,
    "./routes/items/new.tsx": $items_new,
    "./routes/items/overview.tsx": $items_overview,
    "./routes/login.tsx": $login,
  },
  islands: {
    "./islands/Counter.tsx": $Counter,
  },
  baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
