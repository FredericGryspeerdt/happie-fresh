import { type PageProps } from "fresh";
import { Head } from "fresh/runtime";
import { NAV_CONFIG, resolveActiveTab } from "@/config/navigation.ts";
import TabBar from "@/components/TabBar.tsx";
import AppBar from "@/islands/AppBar.tsx";
import { type StateInterface } from "@/utils/define.ts";

export default function App(
  { Component, state, url }: PageProps<unknown, StateInterface>,
) {
  const activeTab = resolveActiveTab(url.pathname);

  return (
    <html>
      <Head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
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
      <body class="pb-16">
        {state?.userId && (
          <>
            {state.appBar
              ? (
                <AppBar
                  mode="detail"
                  title={state.appBar.title}
                  backUrl={state.appBar.backUrl}
                />
              )
              : (
                <AppBar
                  mode="section"
                  activeTabLabel={activeTab?.label ?? "Happie"}
                  subNavItems={activeTab?.subNav ?? []}
                  activeRoute={url.pathname}
                  logoutRoute="/logout"
                />
              )}
            <TabBar
              items={NAV_CONFIG}
              activeTabId={activeTab?.id}
            />
          </>
        )}
        <Component />
      </body>
    </html>
  );
}
