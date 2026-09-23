// deno-lint-ignore-file react-no-danger
import { type PageProps } from "fresh";
import { Head } from "fresh/runtime";
import { resolveActiveTab } from "@/config/navigation.ts";
import AppChrome from "@/islands/shell/AppChrome.tsx";
import { type StateInterface } from "@/utils/define.ts";

const APPLE_SPLASH_SCREENS = [
  { size: "640x1136", width: 320, height: 568, ratio: 2 },
  { size: "750x1334", width: 375, height: 667, ratio: 2 },
  { size: "828x1792", width: 414, height: 896, ratio: 2 },
  { size: "1125x2436", width: 375, height: 812, ratio: 3 },
  { size: "1170x2532", width: 390, height: 844, ratio: 3 },
  { size: "1179x2556", width: 393, height: 852, ratio: 3 },
  { size: "1284x2778", width: 428, height: 926, ratio: 3 },
  { size: "1290x2796", width: 430, height: 932, ratio: 3 },
  { size: "1536x2048", width: 768, height: 1024, ratio: 2 },
  { size: "1668x2224", width: 834, height: 1112, ratio: 2 },
  { size: "1668x2388", width: 834, height: 1194, ratio: 2 },
  { size: "2048x2732", width: 1024, height: 1366, ratio: 2 },
] as const;

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
        {/* Kept in sync with manifest theme_color and --md-surface (assets/styles.css) */}
        <meta name="theme-color" content="#fdfcf9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <title>Happie</title>
        <link
          crossorigin="use-credentials"
          rel="manifest"
          href="/manifest.webmanifest"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {APPLE_SPLASH_SCREENS.map(({ size, width, height, ratio }) => (
          <link
            key={size}
            rel="apple-touch-startup-image"
            href={`/apple-splash-${size}.png`}
            media={`(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`}
          />
        ))}
        {
          /* Chromium fires beforeinstallprompt once, possibly before islands
            hydrate — stash it. Contract (property + event name) is pinned by
            islands/shell/useInstallPrompt.ts and tests/app-head.test.ts.
            dangerouslySetInnerHTML required: render-to-string HTML-escapes
            script text children (file-level lint ignore above). */
        }
        <script
          dangerouslySetInnerHTML={{
            __html:
              'addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();window.__happieInstallPrompt=e;dispatchEvent(new Event("happie:install-ready"))});',
          }}
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
      </Head>
      <body
        style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        {state?.userId && (
          <AppChrome
            activeId={activeTab?.id}
            appBar={state.appBar}
            sectionTitle={activeTab?.label ?? "Happie"}
            actingMember={state.actingMember ?? null}
            actingClaimed={state.actingClaimed === true}
          />
        )}
        <Component />
      </body>
    </html>
  );
}
