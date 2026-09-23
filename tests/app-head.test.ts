import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import App from "@/routes/_app.tsx";

// Renders the app shell logged-out (no userId → no AppChrome island).
function renderApp(): string {
  const props = {
    Component: () => null,
    state: {},
    url: new URL("http://localhost/shopping"),
  } as unknown as Parameters<typeof App>[0];
  return render(h(App, props));
}

Deno.test("app head — no PWABuilder update loader (its SW registration 404s)", () => {
  const html = renderApp();
  assert(!html.includes("pwaupdate"), "pwa-update script should be gone");
  assert(
    !html.includes("pwabuilder"),
    "PWABuilder CDN reference should be gone",
  );
});

Deno.test("app head — theme-color meta matches the manifest color", () => {
  const html = renderApp();
  assertStringIncludes(html, 'name="theme-color" content="#fdfcf9"');
});

Deno.test("app head — apple-touch-icon linked explicitly and file exists", async () => {
  const html = renderApp();
  assertStringIncludes(
    html,
    'rel="apple-touch-icon" href="/apple-touch-icon.png"',
  );
  const stat = await Deno.stat("static/apple-touch-icon.png");
  assert(stat.isFile, "apple-touch-icon.png missing from static/");
});

Deno.test("app head — iOS launch images cover phone and tablet portrait sizes", async () => {
  const html = renderApp();
  const sizes = [
    "640x1136",
    "750x1334",
    "828x1792",
    "1125x2436",
    "1170x2532",
    "1179x2556",
    "1284x2778",
    "1290x2796",
    "1536x2048",
    "1668x2224",
    "1668x2388",
    "2048x2732",
  ];

  for (const size of sizes) {
    const href = `/apple-splash-${size}.png`;
    assertStringIncludes(
      html,
      `rel="apple-touch-startup-image" href="${href}"`,
    );
    const stat = await Deno.stat(`static${href}`);
    assert(stat.isFile, `${href} missing from static/`);
  }

  assertStringIncludes(html, "orientation: portrait");
});

Deno.test("app head — install prompt stash script, unescaped", () => {
  const html = renderApp();
  assertStringIncludes(html, "__happieInstallPrompt");
  assertStringIncludes(html, "happie:install-ready");
  // preact-render-to-string HTML-escapes <script> text children; the
  // script must be emitted via dangerouslySetInnerHTML to stay executable.
  assertStringIncludes(html, 'addEventListener("beforeinstallprompt"');
});
