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
