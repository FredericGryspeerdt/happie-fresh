import { type PageProps } from "fresh";
import { Head } from "fresh/runtime";
import { resolveActiveTab } from "@/config/navigation.ts";
import AppChrome from "@/islands/shell/AppChrome.tsx";
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
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>Happie</title>
        <link
          crossorigin="use-credentials"
          rel="manifest"
          href="/manifest.webmanifest"
        />
        {/* Google Fonts link from Task 0.3 stays here */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script type="module">
          {`import "https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate/dist/pwa-update.js"; const el = document.createElement("pwa-update"); document.body.appendChild(el);`}
        </script>
      </Head>
      <body
        style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        {state?.userId && (
          <AppChrome
            activeId={activeTab?.id}
            appBar={state.appBar}
            sectionTitle={activeTab?.label ?? "Happie"}
          />
        )}
        <Component />
      </body>
    </html>
  );
}
